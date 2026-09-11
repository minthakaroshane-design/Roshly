// ========================================
// ROSHLY — PREMIUM FRONTEND JAVASCRIPT
// ========================================

const urlInput =
    document.getElementById("urlInput");

const downloadBtn =
    document.getElementById("downloadBtn");

const clearBtn =
    document.getElementById("clearBtn");

const pasteBtn =
    document.getElementById("pasteBtn");

const statusMessage =
    document.getElementById("statusMessage");

const videoPreview =
    document.getElementById("videoPreview");

const videoThumbnail =
    document.getElementById("videoThumbnail");

const videoTitle =
    document.getElementById("videoTitle");

const videoDuration =
    document.getElementById("videoDuration");

const qualityBox =
    document.getElementById("qualityBox");

const qualitySelect =
    document.getElementById("qualitySelect");

const startDownloadBtn =
    document.getElementById("startDownloadBtn");

const progressContainer =
    document.getElementById("progressContainer");

const progressBar =
    document.getElementById("progressBar");

const progressPercent =
    document.getElementById("progressPercent");

const progressStatus =
    document.getElementById("progressStatus");

const progressSpeed =
    document.getElementById("progressSpeed");

const progressEta =
    document.getElementById("progressEta");

const themeBtn =
    document.getElementById("themeBtn");


// ========================================
// BUTTON TEXT HELPER
// ========================================

function setButtonText(button, text) {

    if (!button) {
        return;
    }

    const textElement =
        button.querySelector(".button-main-text");

    if (textElement) {

        textElement.textContent =
            text;

    } else {

        button.textContent =
            text;
    }
}


// ========================================
// FORMAT DURATION
// ========================================

function formatDuration(seconds) {

    if (
        !seconds ||
        isNaN(seconds)
    ) {
        return "Duration unavailable";
    }

    seconds =
        Math.floor(seconds);

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const secs =
        seconds % 60;

    if (hours > 0) {

        return (
            hours +
            ":" +
            String(minutes).padStart(2, "0") +
            ":" +
            String(secs).padStart(2, "0")
        );
    }

    return (
        minutes +
        ":" +
        String(secs).padStart(2, "0")
    );
}


// ========================================
// STATUS HELPER
// ========================================

function setStatus(message, type = "normal") {

    if (!statusMessage) {
        return;
    }

    statusMessage.textContent =
        message;

    statusMessage.style.color =
        "";

    if (type === "success") {

        statusMessage.style.color =
            "#08b986";

    } else if (type === "error") {

        statusMessage.style.color =
            "#d85b68";

    } else if (type === "loading") {

        statusMessage.style.color =
            "var(--cyan-dark)";
    }
}


// ========================================
// URL INPUT
// ========================================

if (urlInput) {

    urlInput.addEventListener(
        "input",
        function () {

            if (clearBtn) {

                clearBtn.style.display =
                    urlInput.value.trim()
                        ? "flex"
                        : "none";
            }
        }
    );

    urlInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                if (downloadBtn) {
                    downloadBtn.click();
                }
            }
        }
    );
}


// ========================================
// PASTE BUTTON
// ========================================

if (pasteBtn) {

    pasteBtn.addEventListener(
        "click",
        async function () {

            try {

                const text =
                    await navigator.clipboard.readText();

                if (!text) {

                    setStatus(
                        "Your clipboard is empty.",
                        "error"
                    );

                    return;
                }

                urlInput.value =
                    text.trim();

                clearBtn.style.display =
                    "flex";

                urlInput.focus();

                setStatus(
                    "Link pasted successfully.",
                    "success"
                );

            } catch (error) {

                console.error(
                    "Clipboard error:",
                    error
                );

                setStatus(
                    "Please paste the link manually.",
                    "error"
                );
            }
        }
    );
}


// ========================================
// CLEAR BUTTON
// ========================================

if (clearBtn) {

    clearBtn.addEventListener(
        "click",
        function () {

            urlInput.value = "";

            clearBtn.style.display =
                "none";

            if (qualityBox) {
                qualityBox.style.display =
                    "none";
            }

            if (videoPreview) {
                videoPreview.style.display =
                    "none";
            }

            if (progressContainer) {
                progressContainer.style.display =
                    "none";
            }

            if (qualitySelect) {

                qualitySelect.innerHTML =
                    '<option value="">Select quality</option>';
            }

            if (videoThumbnail) {
                videoThumbnail.src = "";
            }

            if (videoTitle) {
                videoTitle.textContent = "";
            }

            if (videoDuration) {
                videoDuration.textContent =
                    "Duration: --";
            }

            if (progressBar) {
                progressBar.style.width =
                    "0%";
            }

            if (progressPercent) {
                progressPercent.textContent =
                    "0%";
            }

            if (progressStatus) {
                progressStatus.textContent =
                    "Starting download...";
            }

            if (progressSpeed) {
                progressSpeed.textContent =
                    "Preparing...";
            }

            if (progressEta) {
                progressEta.textContent =
                    "ETA --";
            }

            setStatus("");

            setButtonText(
                downloadBtn,
                "Continue"
            );

            setButtonText(
                startDownloadBtn,
                "Download"
            );

            if (downloadBtn) {
                downloadBtn.disabled =
                    false;
            }

            if (startDownloadBtn) {
                startDownloadBtn.disabled =
                    false;
            }

            urlInput.focus();
        }
    );
}


// ========================================
// GET VIDEO INFORMATION
// ========================================

if (downloadBtn) {

    downloadBtn.addEventListener(
        "click",
        async function () {

            const url =
                urlInput.value.trim();

            if (!url) {

                setStatus(
                    "Please paste a link first.",
                    "error"
                );

                urlInput.focus();

                return;
            }

            downloadBtn.disabled =
                true;

            setButtonText(
                downloadBtn,
                "Checking..."
            );

            qualityBox.style.display =
                "none";

            videoPreview.style.display =
                "none";

            progressContainer.style.display =
                "none";

            setStatus(
                "Getting content information...",
                "loading"
            );

            try {

                const response =
                    await fetch(
                        "/api/info",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                url: url
                            })
                        }
                    );

                const data =
                    await response.json();

                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        "Could not get content information."
                    );
                }

                console.log(
                    "Roshly content information:",
                    data
                );


                // ========================================
                // PREVIEW
                // ========================================

                if (data.thumbnail) {

                    videoThumbnail.src =
                        data.thumbnail;

                    videoThumbnail.alt =
                        data.title ||
                        "Content thumbnail";

                } else {

                    videoThumbnail.src = "";
                }

                videoTitle.textContent =
                    data.title ||
                    "Untitled content";

                videoDuration.textContent =
                    "Duration: " +
                    formatDuration(
                        data.duration
                    );

                videoPreview.style.display =
                    "block";


                // ========================================
                // QUALITY OPTIONS
                // ========================================

                qualitySelect.innerHTML =
                    '<option value="">Select quality</option>';

                const qualities =
                    new Map();

                if (
                    Array.isArray(
                        data.formats
                    )
                ) {

                    data.formats.forEach(
                        function (format) {

                            if (!format.hasVideo) {
                                return;
                            }

                            if (!format.height) {
                                return;
                            }

                            const height =
                                Number(
                                    format.height
                                );

                            if (
                                isNaN(height) ||
                                height <= 0
                            ) {
                                return;
                            }

                            if (
                                !qualities.has(
                                    height
                                )
                            ) {

                                qualities.set(
                                    height,
                                    format
                                );

                            } else {

                                const oldFormat =
                                    qualities.get(
                                        height
                                    );

                                if (
                                    format.hasAudio &&
                                    !oldFormat.hasAudio
                                ) {

                                    qualities.set(
                                        height,
                                        format
                                    );
                                }
                            }
                        }
                    );
                }


                // ========================================
                // SORT QUALITY
                // ========================================

                const sortedQualities =
                    Array.from(
                        qualities.entries()
                    ).sort(
                        function (a, b) {
                            return b[0] - a[0];
                        }
                    );


                sortedQualities.forEach(
                    function ([height, format]) {

                        const option =
                            document.createElement(
                                "option"
                            );

                        option.value =
                            format.format_id;

                        option.textContent =
                            height + "p" +
                            (
                                format.hasAudio
                                    ? ""
                                    : " • video"
                            );

                        qualitySelect.appendChild(
                            option
                        );
                    }
                );


                // ========================================
                // AUDIO
                // ========================================

                let audioFormat = null;

                if (
                    Array.isArray(
                        data.formats
                    )
                ) {

                    audioFormat =
                        data.formats.find(
                            function (format) {

                                return (
                                    !format.hasVideo &&
                                    format.hasAudio
                                );
                            }
                        );
                }


                if (audioFormat) {

                    const audioOption =
                        document.createElement(
                            "option"
                        );

                    audioOption.value =
                        audioFormat.format_id;

                    audioOption.textContent =
                        "Audio only";

                    qualitySelect.appendChild(
                        audioOption
                    );
                }


                // ========================================
                // SHOW QUALITY
                // ========================================

                if (
                    qualitySelect.options.length <= 1
                ) {

                    setStatus(
                        "No downloadable qualities found.",
                        "error"
                    );

                    qualityBox.style.display =
                        "none";

                } else {

                    setStatus(
                        "Content found — choose your quality.",
                        "success"
                    );

                    qualityBox.style.display =
                        "block";

                    setTimeout(
                        function () {

                            qualityBox.scrollIntoView({
                                behavior: "smooth",
                                block: "nearest"
                            });

                        },
                        100
                    );
                }

            } catch (error) {

                console.error(
                    "Roshly info error:",
                    error
                );

                videoPreview.style.display =
                    "none";

                qualityBox.style.display =
                    "none";

                setStatus(
                    error.message ||
                    "Something went wrong.",
                    "error"
                );

            } finally {

                downloadBtn.disabled =
                    false;

                setButtonText(
                    downloadBtn,
                    "Continue"
                );
            }
        }
    );
}


// ========================================
// START DOWNLOAD
// ========================================

if (startDownloadBtn) {

    startDownloadBtn.addEventListener(
        "click",
        async function () {

            const url =
                urlInput.value.trim();

            const formatId =
                qualitySelect.value;


            if (!url) {

                setStatus(
                    "Please paste a link first.",
                    "error"
                );

                return;
            }


            if (!formatId) {

                setStatus(
                    "Please choose a quality first.",
                    "error"
                );

                return;
            }


            startDownloadBtn.disabled =
                true;

            setButtonText(
                startDownloadBtn,
                "Starting..."
            );

            qualityBox.style.display =
                "none";

            progressContainer.style.display =
                "block";

            progressBar.style.width =
                "0%";

            progressPercent.textContent =
                "0%";

            progressStatus.textContent =
                "Starting download...";

            progressSpeed.textContent =
                "Preparing...";

            progressEta.textContent =
                "ETA --";

            setStatus(
                "Starting your download...",
                "loading"
            );


            try {

                const response =
                    await fetch(
                        "/api/download",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                url: url,
                                formatId: formatId
                            })
                        }
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        "Could not start download."
                    );
                }


                const jobId =
                    data.jobId;


                if (!jobId) {

                    throw new Error(
                        "Download job was not created."
                    );
                }


                console.log(
                    "Roshly download job:",
                    jobId
                );


                setButtonText(
                    startDownloadBtn,
                    "Downloading..."
                );


                checkProgress(jobId);


            } catch (error) {

                console.error(
                    "Download start error:",
                    error
                );

                setStatus(
                    error.message ||
                    "Download failed.",
                    "error"
                );

                progressStatus.textContent =
                    "Download failed.";

                startDownloadBtn.disabled =
                    false;

                setButtonText(
                    startDownloadBtn,
                    "Download"
                );
            }
        }
    );
}


// ========================================
// CHECK DOWNLOAD PROGRESS
// ========================================

async function checkProgress(jobId) {

    try {

        const response =
            await fetch(
                "/api/progress/" +
                encodeURIComponent(jobId)
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Could not check download progress."
            );
        }


        let percent =
            Number(data.progress);


        if (isNaN(percent)) {
            percent = 0;
        }


        percent =
            Math.max(
                0,
                Math.min(
                    100,
                    percent
                )
            );


        progressBar.style.width =
            percent + "%";

        progressPercent.textContent =
            percent.toFixed(1) + "%";


        progressSpeed.textContent =
            data.speed ||
            "Preparing...";


        progressEta.textContent =
            data.eta
                ? "ETA " + data.eta
                : "ETA --";


        // ========================================
        // STATUS
        // ========================================

        if (
            data.status === "starting"
        ) {

            progressStatus.textContent =
                "Starting download...";

        } else if (
            data.status === "downloading"
        ) {

            progressStatus.textContent =
                "Downloading...";

            setStatus(
                "Roshly is downloading your file...",
                "loading"
            );

        } else if (
            data.status === "processing"
        ) {

            progressStatus.textContent =
                "Processing video...";

            setStatus(
                "Almost done...",
                "loading"
            );

        } else if (
            data.status === "complete"
        ) {

            progressBar.style.width =
                "100%";

            progressPercent.textContent =
                "100%";

            progressStatus.textContent =
                "Download complete!";

            progressSpeed.textContent =
                "Ready";

            progressEta.textContent =
                "Done";

            setStatus(
                "Preparing your file...",
                "success"
            );

            await downloadFile(jobId);

            return;

        } else if (
            data.status === "error"
        ) {

            throw new Error(
                data.error ||
                "Download failed."
            );
        }


        setTimeout(
            function () {
                checkProgress(jobId);
            },
            500
        );


    } catch (error) {

        console.error(
            "Progress error:",
            error
        );

        progressStatus.textContent =
            "Download failed.";

        setStatus(
            error.message ||
            "Download failed.",
            "error"
        );

        startDownloadBtn.disabled =
            false;

        setButtonText(
            startDownloadBtn,
            "Download"
        );
    }
}


// ========================================
// DOWNLOAD FINAL FILE
// ========================================

async function downloadFile(jobId) {

    try {

        setStatus(
            "Preparing your file...",
            "loading"
        );


        const response =
            await fetch(
                "/api/file/" +
                encodeURIComponent(jobId)
            );


        if (!response.ok) {

            let message =
                "Could not retrieve the downloaded file.";

            try {

                const data =
                    await response.json();

                if (data.message) {
                    message =
                        data.message;
                }

            } catch (error) {
                // Ignore
            }

            throw new Error(message);
        }


        const blob =
            await response.blob();


        const downloadUrl =
            window.URL.createObjectURL(
                blob
            );


        const link =
            document.createElement("a");


        link.href =
            downloadUrl;

        link.download =
            "roshly-download";


        document.body.appendChild(
            link
        );

        link.click();

        link.remove();


        setTimeout(
            function () {

                window.URL.revokeObjectURL(
                    downloadUrl
                );

            },
            1000
        );


        setStatus(
            "Download complete!",
            "success"
        );


        progressStatus.textContent =
            "Download complete!";


        startDownloadBtn.disabled =
            false;

        setButtonText(
            startDownloadBtn,
            "Download"
        );


    } catch (error) {

        console.error(
            "File download error:",
            error
        );

        progressStatus.textContent =
            "File download failed.";

        setStatus(
            error.message ||
            "Could not download the file.",
            "error"
        );

        startDownloadBtn.disabled =
            false;

        setButtonText(
            startDownloadBtn,
            "Download"
        );
    }
}


// ========================================
// THEME
// ========================================

function applyTheme(isDark) {

    if (isDark) {

        document.body.classList.add(
            "dark-preview"
        );

        themeBtn.textContent =
            "☾";

        localStorage.setItem(
            "roshly-theme",
            "dark"
        );

    } else {

        document.body.classList.remove(
            "dark-preview"
        );

        themeBtn.textContent =
            "☼";

        localStorage.setItem(
            "roshly-theme",
            "light"
        );
    }
}


if (themeBtn) {

    const savedTheme =
        localStorage.getItem(
            "roshly-theme"
        );

    if (savedTheme === "dark") {

        applyTheme(true);

    } else {

        applyTheme(false);
    }


    themeBtn.addEventListener(
        "click",
        function () {

            const isDark =
                !document.body.classList.contains(
                    "dark-preview"
                );

            applyTheme(isDark);
        }
    );
}


// ========================================
// SCROLL REVEAL
// ========================================

function setupRevealAnimations() {

    const elements =
        document.querySelectorAll(
            ".reveal"
        );


    if (
        !("IntersectionObserver" in window)
    ) {

        elements.forEach(
            function (element) {

                element.classList.add(
                    "visible"
                );
            }
        );

        return;
    }


    const observer =
        new IntersectionObserver(
            function (entries) {

                entries.forEach(
                    function (entry) {

                        if (
                            entry.isIntersecting
                        ) {

                            entry.target.classList.add(
                                "visible"
                            );

                            observer.unobserve(
                                entry.target
                            );
                        }
                    }
                );

            },
            {
                threshold: 0.12
            }
        );


    elements.forEach(
        function (element) {

            observer.observe(
                element
            );
        }
    );
}


// ========================================
// CTA BUTTON
// ========================================

const ctaButton =
    document.querySelector(
        ".cta-button"
    );

if (ctaButton) {

    ctaButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            setTimeout(
                function () {

                    if (urlInput) {
                        urlInput.focus();
                    }

                },
                500
            );
        }
    );
}


// ========================================
// START
// ========================================

setupRevealAnimations();

console.log(
    "Roshly premium frontend loaded successfully."
);