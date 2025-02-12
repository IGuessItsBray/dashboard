document.addEventListener("DOMContentLoaded", function () {
    const toggleInput = document.getElementById("darkModeToggle");

    function switchTheme(event) {
        document.body.classList.add("transitioning"); // Add transition effect
        if (event.target.checked) {
            document.body.classList.add("dark-mode");
            localStorage.setItem("darkMode", "enabled");
        } else {
            document.body.classList.remove("dark-mode");
            localStorage.setItem("darkMode", "disabled");
        }

        // Remove transitioning class after transition completes
        setTimeout(() => document.body.classList.remove("transitioning"), 400);
    }

    toggleInput.addEventListener("change", switchTheme);

    // Load theme on page load
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        toggleInput.checked = true;
    }
});
