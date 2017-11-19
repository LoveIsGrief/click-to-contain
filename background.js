// From https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/contextualIdentities/create
const CONTEXT_COLORS = [
    "blue",
    "turquoise",
    "green",
    "yellow",
    "orange",
    "red",
    "pink",
    "purple"
];

const CONTEXT_ICONS = [
    "fingerprint",
    "briefcase",
    "dollar",
    "cart",
    "circle"
];

const CONTEXT_PREFIX = "CTC_";

/**
 * Key: tab id
 * value: context / cookie store id
 * @type {{}}
 */
const tabContexts = {};

function pickRandomly(array) {
    return array.length > 0 ? array[Math.floor(Math.random() * array.length)] : null
}

var contentPort;

/**
 * Opens a tab in a random context / cookie store
 * @param url {String}
 * @param openerTabId {Number} ID of the tab which is requesting to open a new one
 */
function cmdOpenTab({url}, openerTabId) {
    browser.contextualIdentities.create({
        name: CONTEXT_PREFIX + Date.now(),
        color: pickRandomly(CONTEXT_COLORS),
        icon: pickRandomly(CONTEXT_ICONS)
    }).then((contextIdentity) => {
        browser.tabs.create({
            url: url,
            cookieStoreId: contextIdentity.cookieStoreId,
            openerTabId: openerTabId
        }).then((tab) => {
            tabContexts[tab.id] = contextIdentity.cookieStoreId;
        }).catch((error) => {
            // Don't leave a random context lying around
            browser.contextualIdentities.remove(contextIdentity.cookieStoreId);
            console.error("error creating tab", error);
        })
    }).catch(console.error)
}

function connected(p) {
    contentPort = p;
    contentPort.onMessage.addListener(({command, data}, {sender}) => {
        if (command === "openTab") {
            cmdOpenTab(data, sender.tab.id)
        }
    });
}

browser.runtime.onConnect.addListener(connected);

// Remove the temporary context as well
browser.tabs.onRemoved.addListener((tabId, {windowId, isWindowClosing}) => {
    if (tabContexts[tabId]) {
        browser.contextualIdentities.remove(tabContexts[tabId])
        delete tabContexts[tabId]
    }
})


// Clean up left over containers
browser.contextualIdentities.query({}).then((contexts) => {
    contexts.filter((context) => {
        return context.name.startsWith(CONTEXT_PREFIX)
    }).forEach((context) => {
        browser.contextualIdentities.remove(context.cookieStoreId)
    })
})