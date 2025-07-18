# Auto Tab Refresher - Advanced Cross-Browser Extension

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/momedul/auto-tab-refresher/blob/main/LICENSE) &nbsp;&nbsp; [![GitHub stars](https://img.shields.io/github/stars/momedul/auto-tab-refresher?style=social)](https://github.com/momedul/auto-tab-refresher/stargazers) &nbsp;&nbsp; [![GitHub forks](https://img.shields.io/github/forks/momedul/auto-tab-refresher?style=social)](https://github.com/momedul/auto-tab-refresher/network/members) &nbsp;&nbsp; [![GitHub watchers](https://img.shields.io/github/watchers/momedul/auto-tab-refresher?style=social)](https://github.com/momedul/auto-tab-refresher/watchers) &nbsp;&nbsp; [![GitHub followers](https://img.shields.io/github/followers/momedul?style=social)](https://github.com/momedul?tab=followers)

## 🚀 Overview
**Auto Tab Refresher** is a powerful and highly customizable cross-browser web extension designed to automatically refresh your browser tabs. Whether you need to keep an eye on live dashboards, monitor stock prices, or simply ensure a webpage stays updated, this extension provides a seamless and intelligent solution. With support for individual tab refreshing, bulk refreshing, random intervals, specific time refreshes, and much more, it's the ultimate tool for maintaining fresh content in your browser.

This extension is built with modern web technologies, ensuring it's lightweight, efficient, and compatible with popular browsers like Chrome, Firefox, and Edge.

## ✨ Features

* **Individual Tab Refreshing:** Set unique refresh intervals and options for each tab independently.
* **Refresh All Tabs:** Apply the same refresh settings to all currently open tabs simultaneously.
* **Customizable Refresh Intervals:**
    * Set a fixed interval (in seconds).
    * Use a **Random Interval** between a specified minimum and maximum (e.g., refresh every 30-90 seconds).
    * Schedule a **One-Time Refresh at a Specific Time** (e.g., refresh at 10:30 AM).
* **Hostname Filtering:** Limit refreshes to pages on a specific hostname (e.g., `example.com`), ignoring others.
* **Clear Cache on Refresh:** Option to bypass the browser's cache, ensuring you always get the latest content.
* **Desktop Notifications:** Receive a notification when a tab is refreshed.
* **Click Element Before Refresh:** Specify a CSS selector (e.g., `#myButton`, `.refresh-link`) to automatically click an element on the page before refreshing. Ideal for interacting with "refresh" buttons or dynamic content loaders.
* **Refresh to URL from a List:** Provide a list of URLs, and the extension will cycle through them on each refresh, navigating the tab to the next URL in the list.
* **Persistent Settings:** Your refresh configurations are saved and restored across browser sessions.
* **Background Refreshing:** Tabs that are not in focus will refresh in the background without stealing your attention. Only the actively focused tab (if being refreshed individually) will be brought to the foreground upon refresh.
* **Real-time Timer Label:** The extension's toolbar icon displays a live countdown to the next refresh, formatted concisely (e.g., "05s", "12m", "01h", "3d", "1M", "2y"). When multiple tabs are refreshing, it shows the earliest upcoming refresh.
* **Active Refreshes List:** The popup provides a clear list of all tabs currently being refreshed, showing their title, URL, and the time until their next refresh, along with a dedicated "Stop" button for each.
* **Cross-Browser Compatibility:** Designed to work seamlessly across Chrome, Firefox, and Edge.

## 🛠️ Installation

Since this is a web extension, you'll need to load it as an "unpacked" or "temporary" add-on.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/momedul/auto-tab-refresher.git
    cd auto-tab-refresher
    ```

2.  **Download Tailwind CSS (Crucial Step!):**
    The extension uses a local copy of Tailwind CSS.
    * Go to `https://cdn.tailwindcss.com` in your browser.
    * Right-click on the page and select "Save as..." or "View Page Source" and copy the entire content.
    * Create a new file named `tailwind-browser@4.js` inside your `auto-tab-refresher` project folder (the same folder as `popup.html`, `background.js`, etc.).
    * Paste the copied Tailwind CSS content into `tailwind-browser@4.js`.

3.  **Prepare Icons (Optional but Recommended):**
    Ensure you have an `icons` folder in the root directory, containing `icon16.png`, `icon48.png`, and `icon128.png`. If you don't have them, you can create simple placeholder images or use default ones.

4.  **Load the Extension in Your Browser:**

    ### Google Chrome
    * Open Chrome and navigate to `chrome://extensions`.
    * Enable "Developer mode" (usually a toggle in the top right corner).
    * Click on "Load unpacked" button.
    * Select the `auto-tab-refresher` folder you cloned.

    ### Mozilla Firefox
    * Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
    * Click on "Load Temporary Add-on..." button.
    * Navigate to your `auto-tab-refresher` folder and select any file inside it (e.g., `manifest.json`).
        * *Note: Firefox temporary add-ons are removed when the browser is closed. For persistent use, you'd need to sign and distribute it, but for development, this works.*

    ### Microsoft Edge
    * Open Edge and navigate to `edge://extensions`.
    * Enable "Developer mode" (toggle on the left sidebar).
    * Click on "Load unpacked" button.
    * Select the `auto-tab-refresher` folder you cloned.

## 🚀 Usage

Once installed, you'll see the **Auto Tab Refresher** icon in your browser's toolbar. Click on it to open the popup.

1.  **Current Tab Refresh:**
    * Set your desired `Refresh every (seconds)` interval.
    * Optionally, enable `Random interval` and set min/max seconds.
    * Optionally, enable `Refresh at specific time (one-time)` and select a time.
    * Configure `Advanced Options` like `Hostname filtering`, `Clear cache`, `Show notification`, `Refresh to URL from a list`, or `Click element before refresh`.
    * Click `Start Refresh Current Tab`. The extension will now refresh only the active tab according to your settings.

2.  **Refresh All Tabs:**
    * Configure your desired refresh settings as above.
    * Check the `Refresh all currently open tabs (with current settings)` checkbox.
    * Click `Start Refresh All Tabs`. The extension will start independent refreshes for all open tabs that are valid (e.g., `http://` or `https://` URLs), applying the chosen settings to each.

3.  **Managing Active Refreshes:**
    * The `Active Refreshes` section in the popup will list all tabs currently being refreshed.
    * Each listed tab will show its title, URL, and the time until its next refresh.
    * Click the `Stop` button next to any listed tab to stop its individual refresh.

4.  **Extension Badge Timer:**
    * When a refresh is active, the extension icon in your toolbar will display a live countdown (e.g., "05s", "12m", "01h", "3d"). If multiple tabs are refreshing, it shows the time remaining for the *next* earliest refresh.

## 📸 Screenshots

*(Screenshot1: Main)*
![Screenshot 1](/screenshot1.png)

*(Screenshot2: Active Tabs)*
![Screenshot 2](/screenshot2.png)

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements, new features, or bug fixes, please feel free to:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourFeature` or `fix/BugFix`).
3.  Make your changes and commit them (`git commit -m 'Add YourFeature'`).
4.  Push to the branch (`git push origin feature/YourFeature`).
5.  Open a Pull Request.

Please ensure your code adheres to the existing style and includes relevant comments.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Credits

This extension was Designed, Developed & Maintained by:

<a href="https://mamedul2.github.io"><img src="https://github.com/momedul.png?size=48" width="32" height="32" style="border-radius: 50%; vertical-align: middle;"></a> **[MAMEDUL ISLAM](https://mamedul2.github.io)**


## 👨‍💻 Author & Hire Me
Hi! I'm [Mamedul Islam](https://mamedul.github.io/), a passionate Web Developer who builds modern web applications, E-commerce, PWAs, and fast, static, dynamic, responsive websites. Specializing in WooCommerce, Wordpress, PHP, MySQL, and modern web development. Creating exceptional digital experiences since 2017.

#### 📬 Connect With Me:
[📱 WhatsApp](https://wa.me/8801847406830)&nbsp; • &nbsp;[💼 Fiverr](https://www.fiverr.com/mamedul)&nbsp; • &nbsp;[👔 LinkedIn](https://www.linkedin.com/in/mamedul/)&nbsp; • &nbsp;[💻 GitHub](https://github.com/mamedul)&nbsp; • &nbsp;[🐦 X (Twitter)](https://www.x.com/mamedul)

I'm open for [freelance work](https://www.fiverr.com/mamedul), Woocommerce, E-commerce, Wordpress, PWA development, speed test apps, Firebase projects, websocket, PHP, MySQL and more. [Hire me](https://wa.me/8801847406830) to bring your ideas to life with clean, modern code!


## ⭐ Show Your Support

If you find this extension useful, please consider giving it a star on GitHub! Your support helps motivate further development and improvements.

[![GitHub stars](https://img.shields.io/github/stars/momedul/auto-tab-refresher?style=for-the-badge)](https://github.com/momedul/auto-tab-refresher/stargazers)
