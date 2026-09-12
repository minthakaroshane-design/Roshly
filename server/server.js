const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();

const PORT = 3000;

// =========================================================
// CONFIGURATION
// =========================================================

const PYTHON = "python3";

const downloadsFolder = path.join(__dirname, "../downloads");

// Maximum simultaneous downloads
const MAX_ACTIVE_DOWNLOADS = 3;

// yt-dlp information timeout
const INFO_TIMEOUT = 60 * 1000;

// Maximum download time
const DOWNLOAD_TIMEOUT = 20 * 60 * 1000;

// Download cleanup age
const CLEANUP_AGE = 60 * 60 * 1000;

// Job cleanup age
const JOB_CLEANUP_AGE = 60 * 60 * 1000;

// Maximum stdout/stderr stored in memory
const MAX_PROCESS_OUTPUT = 2 * 1024 * 1024;

// =========================================================
// CREATE DOWNLOADS FOLDER
// =========================================================

if (!fs.existsSync(downloadsFolder)) {
    fs.mkdirSync(downloadsFolder, {
        recursive: true
    });
}

// =========================================================
// SECURITY HEADERS
// =========================================================

app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        }
    })
);

// =========================================================
// CORS
// =========================================================

const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://roshly-production.up.railway.app"
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(
                new Error("CORS policy blocked this request.")
            );
        },
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"]
    })
);

// =========================================================
// REQUEST BODY LIMIT
// =========================================================

app.use(
    express.json({
        limit: "100kb"
    })
);

// =========================================================
// RATE LIMITING
// =========================================================

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: "Too many requests. Please wait a minute and try again."
    }
});

const infoLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: "Too many information requests. Please wait a minute and try again."
    }
});

const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: "Too many requests. Please slow down."
    }
});

// =========================================================
// SERVE FRONTEND
// =========================================================

app.use(
    express.static(
        path.join(__dirname, "../public")
    )
);

// =========================================================
// JOB STORAGE
// =========================================================

const jobs = new Map();

let activeDownloads = 0;

// =========================================================
// URL VALIDATION
// =========================================================

function isValidUrl(value) {
    if (typeof value !== "string") {
        return false;
    }

    if (value.length > 2048) {
        return false;
    }

    try {
        const url = new URL(value);

        return (
            (url.protocol === "http:" ||
                url.protocol === "https:") &&
            !!url.hostname
        );
    } catch {
        return false;
    }
}

// =========================================================
// PLATFORM DETECTION
// =========================================================

function getPlatformFromUrl(value) {
    try {
        const hostname =
            new URL(value)
                .hostname
                .toLowerCase()
                .replace(/^www\./, "");

        if (
            hostname === "youtube.com" ||
            hostname === "youtu.be" ||
            hostname.endsWith(".youtube.com")
        ) {
            return "youtube";
        }

        if (
            hostname === "instagram.com" ||
            hostname.endsWith(".instagram.com")
        ) {
            return "instagram";
        }

        if (
            hostname === "facebook.com" ||
            hostname === "fb.watch" ||
            hostname.endsWith(".facebook.com")
        ) {
            return "facebook";
        }

        if (
            hostname === "tiktok.com" ||
            hostname.endsWith(".tiktok.com")
        ) {
            return "tiktok";
        }

        if (
            hostname === "x.com" ||
            hostname === "twitter.com" ||
            hostname.endsWith(".x.com") ||
            hostname.endsWith(".twitter.com")
        ) {
            return "twitter";
        }

        if (
            hostname === "reddit.com" ||
            hostname.endsWith(".reddit.com")
        ) {
            return "reddit";
        }

        if (
            hostname === "pinterest.com" ||
            hostname.endsWith(".pinterest.com")
        ) {
            return "pinterest";
        }

        if (
            hostname === "snapchat.com" ||
            hostname.endsWith(".snapchat.com")
        ) {
            return "snapchat";
        }

        if (
            hostname === "linkedin.com" ||
            hostname.endsWith(".linkedin.com")
        ) {
            return "linkedin";
        }

        if (
            hostname === "threads.net" ||
            hostname.endsWith(".threads.net")
        ) {
            return "threads";
        }

        return "unknown";
    } catch {
        return "unknown";
    }
}

// =========================================================
// FORMAT ID VALIDATION
// =========================================================

function isValidFormatId(value) {
    if (typeof value !== "string") {
        return false;
    }

    if (value.length === 0 || value.length > 100) {
        return false;
    }

    return /^[A-Za-z0-9._-]+$/.test(value);
}

// =========================================================
// SAFE FILENAME
// =========================================================

function cleanTitle(title) {
    if (typeof title !== "string") {
        return "roshly-download";
    }

    title = title
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 100);

    return title || "roshly-download";
}

// =========================================================
// SAFE DOWNLOAD PATH
// =========================================================

function isSafeDownloadPath(filePath) {
    const resolvedFolder = path.resolve(
        downloadsFolder
    );

    const resolvedFile = path.resolve(
        filePath
    );

    return (
        resolvedFile.startsWith(
            resolvedFolder + path.sep
        )
    );
}

// =========================================================
// AUTOMATIC DOWNLOAD CLEANUP
// =========================================================

function cleanupDownloads() {
    try {
        const files = fs.readdirSync(
            downloadsFolder
        );

        const now = Date.now();

        for (const file of files) {
            const filePath = path.join(
                downloadsFolder,
                file
            );

            try {
                const stats = fs.statSync(
                    filePath
                );

                if (!stats.isFile()) {
                    continue;
                }

                const age =
                    now - stats.mtimeMs;

                if (age > CLEANUP_AGE) {
                    fs.unlinkSync(filePath);

                    console.log(
                        `[CLEANUP] Deleted old file: ${file}`
                    );
                }
            } catch (error) {
                console.error(
                    `[CLEANUP] Could not process ${file}:`,
                    error.message
                );
            }
        }
    } catch (error) {
        console.error(
            "[CLEANUP] Could not scan downloads folder:",
            error.message
        );
    }
}

setInterval(
    cleanupDownloads,
    10 * 60 * 1000
);

cleanupDownloads();

// =========================================================
// RUN YT-DLP SAFELY
// =========================================================

function runYtDlp(
    args,
    timeout = INFO_TIMEOUT
) {
    return new Promise(
        (resolve, reject) => {
            let finished = false;

            const child = spawn(
                PYTHON,
                [
                    "-m",
                    "yt_dlp",
                    ...args
                ],
                {
                    windowsHide: true,
                    shell: false
                }
            );

            let stdout = "";
            let stderr = "";

            const finishReject = (error) => {
                if (finished) {
                    return;
                }

                finished = true;

                try {
                    child.kill();
                } catch {}

                reject(error);
            };

            const timer = setTimeout(() => {
                const error =
                    new Error(
                        "yt-dlp process timed out."
                    );

                error.code =
                    "PROCESS_TIMEOUT";

                finishReject(error);
            }, timeout);

            child.stdout.on(
                "data",
                (data) => {
                    if (
                        stdout.length <
                        MAX_PROCESS_OUTPUT
                    ) {
                        stdout += data.toString();

                        if (
                            stdout.length >
                            MAX_PROCESS_OUTPUT
                        ) {
                            stdout =
                                stdout.substring(
                                    0,
                                    MAX_PROCESS_OUTPUT
                                );
                        }
                    }
                }
            );

            child.stderr.on(
                "data",
                (data) => {
                    if (
                        stderr.length <
                        MAX_PROCESS_OUTPUT
                    ) {
                        stderr += data.toString();

                        if (
                            stderr.length >
                            MAX_PROCESS_OUTPUT
                        ) {
                            stderr =
                                stderr.substring(
                                    0,
                                    MAX_PROCESS_OUTPUT
                                );
                        }
                    }
                }
            );

            child.on(
                "error",
                (error) => {
                    clearTimeout(timer);
                    finishReject(error);
                }
            );

            child.on(
                "close",
                (code) => {
                    if (finished) {
                        return;
                    }

                    finished = true;

                    clearTimeout(timer);

                    if (code !== 0) {
                        const error =
                            new Error(
                                stderr.trim() ||
                                `yt-dlp exited with code ${code}`
                            );

                        error.stderr =
                            stderr;

                        reject(error);
                        return;
                    }

                    resolve({
                        stdout,
                        stderr
                    });
                }
            );
        }
    );
}

// =========================================================
// CLEAN ERROR MESSAGE
// =========================================================

function cleanError(message) {
    if (!message) {
        return "Something went wrong.";
    }

    return String(message)
        .replace(
            /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
            ""
        )
        .trim()
        .split("\n")
        .filter(
            (line) =>
                line.trim()
        )
        .slice(-6)
        .join(" ")
        .substring(0, 1000);
}

// =========================================================
// SET JOB ERROR
// =========================================================

function setJobError(
    jobId,
    message
) {
    const job = jobs.get(jobId);

    if (!job) {
        return;
    }

    job.status = "error";
    job.progress = 0;
    job.speed = "";
    job.eta = "";
    job.file = null;
    job.error =
        message ||
        "Download failed.";
    job.finishedAt =
        Date.now();
}

// =========================================================
// CLEANUP OLD JOB RECORDS
// =========================================================

function cleanupOldJobs() {
    const now = Date.now();

    for (
        const [jobId, job]
        of jobs.entries()
    ) {
        if (
            job.status !== "complete" &&
            job.status !== "error"
        ) {
            continue;
        }

        if (!job.finishedAt) {
            job.finishedAt =
                now;
            continue;
        }

        const age =
            now - job.finishedAt;

        if (
            age >
            JOB_CLEANUP_AGE
        ) {
            jobs.delete(jobId);

            console.log(
                `[CLEANUP] Removed old job: ${jobId}`
            );
        }
    }
}

setInterval(
    cleanupOldJobs,
    10 * 60 * 1000
);

// =========================================================
// BACKEND STATUS
// =========================================================

app.get(
    "/api/status",
    readLimiter,
    (req, res) => {
        res.json({
            success: true,
            message:
                "Roshly backend is running!"
        });
    }
);

// =========================================================
// GET VIDEO INFORMATION
// =========================================================

app.post(
    "/api/info",
    infoLimiter,
    async (req, res) => {
        const { url } =
            req.body || {};

        if (
            typeof url !==
            "string"
        ) {
            return res.status(400)
                .json({
                    success: false,
                    message:
                        "Invalid request."
                });
        }

        if (
            url.length >
            2048
        ) {
            return res.status(400)
                .json({
                    success: false,
                    message:
                        "URL is too long."
                });
        }

        if (
            !isValidUrl(url)
        ) {
            return res.status(400)
                .json({
                    success: false,
                    message:
                        "Please enter a valid URL."
                });
        }

        console.log("");
        console.log(
            "===================================="
        );
        console.log(
            "ROSHLY INFO REQUEST"
        );
        console.log(
            "PLATFORM:",
            getPlatformFromUrl(url)
        );
        console.log(
            "===================================="
        );

        try {
            const result =
                await runYtDlp([
                    "--dump-single-json",
                    "--no-playlist",
                    "--no-warnings",
                    url
                ]);

            let info;

            try {
                info =
                    JSON.parse(
                        result.stdout
                    );
            } catch {
                return res.status(500)
                    .json({
                        success: false,
                        message:
                            "Could not read video information."
                    });
            }

            const formats =
                (info.formats || [])
                    .filter(
                        (format) =>
                            format.url &&
                            (
                                format.vcodec !==
                                    "none" ||
                                format.acodec !==
                                    "none"
                            )
                    )
                    .map(
                        (format) => ({
                            format_id:
                                String(
                                    format.format_id ||
                                        ""
                                ),
                            ext:
                                format.ext ||
                                "unknown",
                            resolution:
                                format.resolution ||
                                (
                                    format.height
                                        ? `${format.height}p`
                                        : "Audio"
                                ),
                            filesize:
                                format.filesize ||
                                format.filesize_approx ||
                                null,
                            height:
                                format.height ||
                                null,
                            width:
                                format.width ||
                                null,
                            fps:
                                format.fps ||
                                null,
                            hasVideo:
                                format.vcodec !==
                                "none",
                            hasAudio:
                                format.acodec !==
                                "none"
                        })
                    );

            res.json({
                success: true,
                title:
                    info.title ||
                    "Untitled",
                thumbnail:
                    info.thumbnail ||
                    "",
                duration:
                    info.duration ||
                    0,
                uploader:
                    info.uploader ||
                    "",
                platform:
                    info.extractor_key ||
                    info.extractor ||
                    "",
                formats
            });
        } catch (error) {
            console.error(
                "ROSHLY INFO ERROR:",
                error.message
            );

            const errorText =
                String(
                    error.message || ""
                ).toLowerCase();

            const platform =
                getPlatformFromUrl(url);

            let message =
                "Could not retrieve this media.";

            // Instagram-specific errors
            if (
                platform === "instagram" &&
                errorText.includes(
                    "there is no video in this post"
                )
            ) {
                message =
                    "This Instagram post does not contain a downloadable video.";
            } else if (
                platform === "instagram" &&
                (
                    errorText.includes("login") ||
                    errorText.includes("authentication") ||
                    errorText.includes("logged in") ||
                    errorText.includes("sign in")
                )
            ) {
                message =
                    "Instagram requires login to access this post.";
            } else if (
                platform === "instagram" &&
                errorText.includes("private")
            ) {
                message =
                    "This Instagram post is private and cannot be accessed.";
            }

            // YouTube-specific errors
            else if (
                platform === "youtube" &&
                (
                    errorText.includes("sign in to confirm") ||
                    errorText.includes("not a bot") ||
                    errorText.includes("use --cookies") ||
                    errorText.includes("authentication")
                )
            ) {
                message =
                    "YouTube requires additional verification to access this video.";
            }

            // Rate limiting
            else if (
                errorText.includes("rate") ||
                errorText.includes("429")
            ) {
                message =
                    "The platform is temporarily limiting requests. Please try again later.";
            }

            // Generic authentication error
            else if (
                errorText.includes("login") ||
                errorText.includes("authentication") ||
                errorText.includes("logged in") ||
                errorText.includes("sign in")
            ) {
                message =
                    "This media requires authentication to access.";
            }

            // Private content
            else if (
                errorText.includes("private")
            ) {
                message =
                    "This media is private and cannot be accessed.";
            }

            res.status(400).json({
                success: false,
                message
            });
        }
    }
);

// =========================================================
// START DOWNLOAD
// =========================================================

app.post(
    "/api/download",
    apiLimiter,
    async (req, res) => {
        const {
            url,
            formatId
        } = req.body || {};

        // Type validation
        if (
            typeof url !==
                "string" ||
            typeof formatId !==
                "string"
        ) {
            return res.status(400)
                .json({
                    success: false,
                    message:
                        "Invalid request."
                });
        }

        // Length validation
        if (
            url.length >
                2048 ||
            formatId.length >
                100
        ) {
            return res.status(400)
                .json({
                    success: false,
                    message:
                        "Input is too long."
                });
        }

        // URL validation
        if (
            !url ||
            !isValidUrl(url) ||
            !formatId
        ) {
            return res.status(400)
                .json({
                    success: false,
                    message:
                        "Please enter a valid URL and quality."
                });
        }

        // Format ID validation
        if (
            !isValidFormatId(
                formatId
            )
        ) {
            return res.status(400)
                .json({
                    success: false,
                    message:
                        "Invalid quality selection."
                });
        }

        // Prevent too many simultaneous downloads
        if (
            activeDownloads >=
            MAX_ACTIVE_DOWNLOADS
        ) {
            return res.status(429)
                .json({
                    success: false,
                    message:
                        "Roshly is currently busy. Please try again shortly."
                });
        }

        activeDownloads++;

        const jobId =
            crypto.randomUUID();

        jobs.set(
            jobId,
            {
                status:
                    "starting",
                progress: 0,
                speed: "",
                eta: "",
                file: null,
                error: null,
                finishedAt:
                    null
            }
        );

        // Immediately send job ID
        res.json({
            success: true,
            jobId
        });

        try {
            // =================================================
            // GET VIDEO INFORMATION
            // =================================================

            const result =
                await runYtDlp(
                    [
                        "--dump-single-json",
                        "--no-playlist",
                        "--no-warnings",
                        url
                    ],
                    INFO_TIMEOUT
                );

            let info;

            try {
                info =
                    JSON.parse(
                        result.stdout
                    );
            } catch {
                setJobError(
                    jobId,
                    "Could not process video information."
                );

                activeDownloads--;
                return;
            }

            // =================================================
            // FIND SELECTED FORMAT
            // =================================================

            const selectedFormat =
                (info.formats || [])
                    .find(
                        (format) =>
                            String(
                                format.format_id
                            ) ===
                            String(
                                formatId
                            )
                    );

            if (
                !selectedFormat
            ) {
                setJobError(
                    jobId,
                    "Selected quality is not available."
                );

                activeDownloads--;
                return;
            }

            // =================================================
            // BUILD FORMAT SELECTOR
            // =================================================

            let formatSelector =
                String(
                    selectedFormat.format_id
                );

            if (
                selectedFormat.vcodec !==
                    "none" &&
                selectedFormat.acodec ===
                    "none"
            ) {
                formatSelector =
                    `${formatSelector}+bestaudio`;
            }

            // =================================================
            // CLEAN TITLE
            // =================================================

            const title =
                cleanTitle(
                    info.title
                );

            // =================================================
            // OUTPUT TEMPLATE
            // =================================================

            const outputTemplate =
                path.join(
                    downloadsFolder,
                    `${title}-${jobId}.%(ext)s`
                );

            if (
                !isSafeDownloadPath(
                    outputTemplate
                )
            ) {
                setJobError(
                    jobId,
                    "Unsafe output path."
                );

                activeDownloads--;
                return;
            }

            // =================================================
            // UPDATE JOB
            // =================================================

            const job =
                jobs.get(
                    jobId
                );

            if (job) {
                job.status =
                    "downloading";
            }

            console.log("");
            console.log(
                "===================================="
            );
            console.log(
                "ROSHLY DOWNLOAD STARTED"
            );
            console.log(
                "JOB:",
                jobId
            );
            console.log(
                "FORMAT:",
                formatSelector
            );
            console.log(
                "PLATFORM:",
                getPlatformFromUrl(url)
            );
            console.log(
                "===================================="
            );

            // =================================================
            // START YT-DLP
            // =================================================

            const downloader =
                spawn(
                    PYTHON,
                    [
                        "-m",
                        "yt_dlp",
                        "--newline",
                        "--no-playlist",
                        "--progress",
                        "-f",
                        formatSelector,
                        "--merge-output-format",
                        "mp4",
                        "-o",
                        outputTemplate,
                        url
                    ],
                    {
                        windowsHide:
                            true,
                        shell: false
                    }
                );

            let downloadError =
                "";

            let processFinished =
                false;

            const downloadTimer =
                setTimeout(
                    () => {
                        if (
                            processFinished
                        ) {
                            return;
                        }

                        console.log(
                            `[TIMEOUT] Killing download ${jobId}`
                        );

                        try {
                            downloader.kill();
                        } catch {}
                    },
                    DOWNLOAD_TIMEOUT
                );

            // =================================================
            // STDOUT
            // =================================================

            downloader.stdout.on(
                "data",
                (data) => {
                    const text =
                        data.toString();

                    console.log(
                        text
                    );

                    parseProgress(
                        text,
                        jobId
                    );
                }
            );

            // =================================================
            // STDERR
            // =================================================

            downloader.stderr.on(
                "data",
                (data) => {
                    const text =
                        data.toString();

                    if (
                        downloadError.length <
                        MAX_PROCESS_OUTPUT
                    ) {
                        downloadError +=
                            text;

                        if (
                            downloadError.length >
                            MAX_PROCESS_OUTPUT
                        ) {
                            downloadError =
                                downloadError.substring(
                                    0,
                                    MAX_PROCESS_OUTPUT
                                );
                        }
                    }

                    console.log(
                        text
                    );

                    parseProgress(
                        text,
                        jobId
                    );
                }
            );

            // =================================================
            // PROCESS ERROR
            // =================================================

            downloader.on(
                "error",
                (error) => {
                    console.error(
                        "ROSHLY DOWNLOADER ERROR:",
                        error.message
                    );

                    setJobError(
                        jobId,
                        "Download process failed."
                    );
                }
            );

            // =================================================
            // DOWNLOAD FINISHED
            // =================================================

            downloader.on(
                "close",
                (code) => {
                    processFinished =
                        true;

                    clearTimeout(
                        downloadTimer
                    );

                    activeDownloads =
                        Math.max(
                            0,
                            activeDownloads - 1
                        );

                    console.log(
                        "yt-dlp process exited with code:",
                        code
                    );

                    if (
                        code !== 0
                    ) {
                        setJobError(
                            jobId,
                            "Download failed."
                        );

                        return;
                    }

                    // =================================================
                    // FIND DOWNLOADED FILE
                    // =================================================

                    let downloadedFile =
                        null;

                    try {
                        const files =
                            fs.readdirSync(
                                downloadsFolder
                            );

                        const matchingFiles =
                            files.filter(
                                (file) =>
                                    file.includes(
                                        jobId
                                    )
                            );

                        if (
                            matchingFiles.length >
                            0
                        ) {
                            downloadedFile =
                                matchingFiles[0];
                        }
                    } catch (
                        error
                    ) {
                        console.error(
                            "Could not read downloads folder:",
                            error.message
                        );
                    }

                    // =================================================
                    // FILE NOT FOUND
                    // =================================================

                    if (
                        !downloadedFile
                    ) {
                        setJobError(
                            jobId,
                            "Download finished but the file was not found."
                        );

                        return;
                    }

                    // =================================================
                    // FINAL FILE PATH SECURITY CHECK
                    // =================================================

                    const finalFilePath =
                        path.join(
                            downloadsFolder,
                            downloadedFile
                        );

                    if (
                        !isSafeDownloadPath(
                            finalFilePath
                        )
                    ) {
                        setJobError(
                            jobId,
                            "Unsafe download file."
                        );

                        try {
                            fs.unlinkSync(
                                finalFilePath
                            );
                        } catch {}

                        return;
                    }

                    // =================================================
                    // MARK COMPLETE
                    // =================================================

                    const finishedJob =
                        jobs.get(
                            jobId
                        );

                    if (
                        finishedJob
                    ) {
                        finishedJob.status =
                            "complete";

                        finishedJob.progress =
                            100;

                        finishedJob.file =
                            downloadedFile;

                        finishedJob.error =
                            null;

                        finishedJob.finishedAt =
                            Date.now();
                    }

                    console.log("");
                    console.log(
                        "===================================="
                    );
                    console.log(
                        "ROSHLY DOWNLOAD COMPLETE"
                    );
                    console.log(
                        "FILE:",
                        downloadedFile
                    );
                    console.log(
                        "===================================="
                    );
                    console.log("");
                }
            );
        } catch (
            error
        ) {
            activeDownloads =
                Math.max(
                    0,
                    activeDownloads - 1
                );

            console.error(
                "ROSHLY DOWNLOAD ERROR:",
                error.message
            );

            if (
                error.code ===
                "PROCESS_TIMEOUT"
            ) {
                setJobError(
                    jobId,
                    "The download took too long and was stopped."
                );
            } else {
                setJobError(
                    jobId,
                    "Could not download this video."
                );
            }
        }
    }
);

// =========================================================
// PARSE DOWNLOAD PROGRESS
// =========================================================

function parseProgress(
    text,
    jobId
) {
    const job =
        jobs.get(jobId);

    if (!job) {
        return;
    }

    // Progress percentage
    const percentMatch =
        text.match(
            /(\d+(?:\.\d+)?)%/
        );

    if (
        percentMatch
    ) {
        const percent =
            Number(
                percentMatch[1]
            );

        if (
            !isNaN(percent)
        ) {
            job.progress =
                Math.min(
                    100,
                    Math.max(
                        0,
                        percent
                    )
                );
        }
    }

    // Download speed
    const speedMatch =
        text.match(
            /at\s+([^\s]+)/
        );

    if (
        speedMatch
    ) {
        job.speed =
            speedMatch[1];
    }

    // ETA
    const etaMatch =
        text.match(
            /ETA\s+([0-9:]+)/
        );

    if (
        etaMatch
    ) {
        job.eta =
            etaMatch[1];
    }

    // Processing / merging
    if (
        text.includes(
            "Merging"
        ) ||
        text.includes(
            "Post-process"
        ) ||
        text.includes(
            "Fixing"
        )
    ) {
        job.status =
            "processing";
    }
}

// =========================================================
// GET DOWNLOAD PROGRESS
// =========================================================

app.get(
    "/api/progress/:jobId",
    readLimiter,
    (req, res) => {
        const jobId =
            req.params.jobId;

        if (
            !/^[0-9a-f-]{36}$/i.test(
                jobId
            )
        ) {
            return res.status(400)
                .json({
                    success: false,
                    message:
                        "Invalid job ID."
                });
        }

        const job =
            jobs.get(
                jobId
            );

        if (!job) {
            return res.status(404)
                .json({
                    success: false,
                    message:
                        "Download job not found."
                });
        }

        res.json({
            success: true,
            status:
                job.status,
            progress:
                job.progress,
            speed:
                job.speed,
            eta:
                job.eta,
            file:
                job.file,
            error:
                job.error
        });
    }
);

// =========================================================
// DOWNLOAD COMPLETED FILE
// =========================================================

app.get(
    "/api/file/:jobId",
    readLimiter,
    (req, res) => {
        const jobId =
            req.params.jobId;

        if (
            !/^[0-9a-f-]{36}$/i.test(
                jobId
            )
        ) {
            return res.status(400)
                .json({
                    success: false,
                    message:
                        "Invalid job ID."
                });
        }

        const job =
            jobs.get(
                jobId
            );

        if (
            !job ||
            !job.file
        ) {
            return res.status(404)
                .json({
                    success: false,
                    message:
                        "File is not ready."
                });
        }

        const filePath =
            path.join(
                downloadsFolder,
                job.file
            );

        if (
            !isSafeDownloadPath(
                filePath
            )
        ) {
            return res.status(403)
                .json({
                    success: false,
                    message:
                        "Invalid file path."
                });
        }

        if (
            !fs.existsSync(
                filePath
            )
        ) {
            return res.status(404)
                .json({
                    success: false,
                    message:
                        "File no longer exists."
                });
        }

        res.download(
            filePath,
            job.file
        );
    }
);

// =========================================================
// SITEMAP
// =========================================================

app.get(
    "/sitemap.xml",
    (req, res) => {
        res.type("application/xml");

        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://roshly-production.up.railway.app/</loc>
    </url>
</urlset>`);
    }
);

// =========================================================
// FRONTEND
// =========================================================

app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "../public/index.html"
            )
        );
    }
);

// =========================================================
// ERROR HANDLER
// =========================================================

app.use(
    (err, req, res, next) => {
        console.error(
            "SERVER ERROR:",
            err.message
        );

        if (
            err.message ===
            "CORS policy blocked this request."
        ) {
            return res.status(403)
                .json({
                    success: false,
                    message:
                        "Request blocked."
                });
        }

        if (
            err.type ===
            "entity.too.large"
        ) {
            return res.status(413)
                .json({
                    success: false,
                    message:
                        "Request is too large."
                });
        }

        res.status(500)
            .json({
                success: false,
                message:
                    "Internal server error."
            });
    }
);

// =========================================================
// START SERVER
// =========================================================

app.listen(
    PORT,
    () => {
        console.log("");
        console.log(
            "===================================="
        );
        console.log(
            "          ROSHLY BACKEND"
        );
        console.log(
            "===================================="
        );
        console.log(
            `Roshly: http://localhost:${PORT}`
        );
        console.log(
            `Python: ${PYTHON}`
        );
        console.log(
            "Security: Helmet + Rate Limit + Validation"
        );
        console.log(
            "===================================="
        );
        console.log("");
    }
);