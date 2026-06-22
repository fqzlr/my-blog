const fs = require("fs");
let c = fs.readFileSync("src/components/layout/Navbar.astro", "utf8");

// Add theme toggle button and admin button after search button
const searchBtn = `<button aria-label="Search" name="Search" class="btn-plain h-11 w-11" id="nav-search-btn">
                    <Icon name="material-symbols:search-rounded" is:inline class="text-[1.65rem]" style="font-variation-settings: \'wght\' 700"></Icon>
                </button>`;

const newButtons = `<button aria-label="Search" name="Search" class="btn-plain h-11 w-11" id="nav-search-btn">
                    <Icon name="material-symbols:search-rounded" is:inline class="text-[1.65rem]" style="font-variation-settings: \'wght\' 700"></Icon>
                </button>
                <button aria-label="Toggle theme" name="Theme" class="btn-plain h-11 w-11 hidden sm:inline-flex!" id="nav-theme-btn" title="Toggle theme">
                    <Icon name="material-symbols:light-mode" is:inline class="text-[1.3rem] dark:hidden"></Icon>
                    <Icon name="material-symbols:dark-mode" is:inline class="text-[1.3rem] hidden dark:inline-block"></Icon>
                </button>
                <button aria-label="Admin" name="Admin" class="btn-plain h-11 w-11 hidden sm:inline-flex!" id="nav-admin-btn" title="Admin panel" onclick="window.location.href='/admin/'">
                    <Icon name="material-symbols:admin-panel-settings" is:inline class="text-[1.3rem]"></Icon>
                </button>`;

c = c.replace(searchBtn, newButtons);

// Add theme toggle script at bottom of the script section
const endScript = `document.getElementById("navbar")?.addEventListener("click", (e) => {`;
c = c.replace(endScript, `// Theme toggle button
document.getElementById("navbar")?.addEventListener("click", (e) => {
    const themeBtn = (e.target as HTMLElement)?.closest?.("#nav-theme-btn");
    if (themeBtn) {
        e.stopPropagation();
        const isDark = document.documentElement.classList.contains("dark");
        if (isDark) {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
        } else {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
        }
        return;
    }
});

document.getElementById("navbar")?.addEventListener("click", (e) => {`);

fs.writeFileSync("src/components/layout/Navbar.astro", c, "utf8");
console.log("Navbar updated with theme toggle and admin button");
