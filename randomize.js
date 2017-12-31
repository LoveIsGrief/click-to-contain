const backgroundPort = browser.runtime.connect({
    name: "content-to-background"
});

const ACCEPTED_PROTOCOLS = ["ftp", "file", "http", "https"].map(protocol => `${protocol}:`);

class Group {
    constructor({enabled, domainsRegexs}) {
        this.enabled = enabled || false;
        this.domainsRegexs = (domainsRegexs || []).map(makeClassInstantiator(RegExp));
    }
}


function makeClassInstantiator(_class) {
    return function (object) {
        return new _class(object)
    }
}

function makeMatcher(toMatch) {
    /**
     *
     * @param regex {RegExp}
     */
    return function matchesRegex(regex) {
        return regex.test(toMatch)
    }

}

function canUseGroup(group, toMatch) {
    toMatch = typeof toMatch === "string" ? toMatch : window.location;
    if (!group.enabled) {
        return
    }
    return group.domainsRegexs.find(makeMatcher(toMatch))
}

/**
 * @typedef {Function} RandomContainerFunction
 *
 * A function that will request the background script to create a random container with the {@see url}
 *
 * @param {Event} event
 * @field {String} url - The URL to use when opening a new container
 *
 */

/**
 *
 * @param {String} url
 * @returns {RandomContainerFunction}
 */
function createOpenInRandomOnClick(url) {
    function onClickLink(event) {
        try {
            // TODO improve contextualIdentities doc
            // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/contextualIdentities/create
            // Impossible to use contextualIdentities in contentScript
            backgroundPort.postMessage({
                command: "openTab",
                data: {
                    url: onClickLink.url
                }
            })
        } catch (e) {
            console.error("problem while posting message on click", e)
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
    onClickLink.url = url;
    return onClickLink
}

/**
 * Don't allow creating containers for any ol' protocol!
 *
 * @param url {String}
 * @returns {Boolean}
 */
function isValidProtocol(url) {
    return url && ACCEPTED_PROTOCOLS.includes((new URL(url)).protocol)
}


/**
 * Keeps track of the nodes we sullied and which click-function they have.
 * @type {Map<Node, RandomContainerFunction>}
 */
let sulliedMap = new Map();

/**
 * Watch the document for insertions and changes to anchor tags and try to force them opening in new containers
 *
 * @param group {Group}
 */
function sullyLinks(group) {
    var observer = new MutationObserver((mutations) => {
        let sulliedLinks = 0;
        mutations
            // Reduce because the logs pointed to some elements of the array being array of MutationRecords
            // … or I was reading the logs wrong
            .reduce((acc, curr) => {
                if (Array.isArray(curr)) {
                    acc = acc.concat(curr)
                } else {
                    acc.push(curr);
                }
                return acc
            }, [])
            .forEach((mutation) => {
                // Include the target, since its attribute might've changed
                [mutation.target].concat(Array.prototype.map.call(mutation.addedNodes, n => n))
                    .filter(node => node.nodeName.toLowerCase() === "a")
                    .filter($a => isValidProtocol($a.href) && !canUseGroup(group, $a.href))
                    .forEach(($a) => {
                        try {
                            // Use a custom click function that is called before any other onclick functions
                            let onClick = sulliedMap.get($a);
                            if (onClick) {
                                onClick.url = $a.href;
                            } else {
                                onClick = createOpenInRandomOnClick($a.href);
                                sulliedMap.set($a, onClick);
                                $a.addEventListener("click", onClick, true);
                            }
                            sulliedLinks++;
                        } catch (e) {
                            console.error("Problem when trying to sully a link", e)
                        }
                    })
            })
        console.log("sullied", sulliedLinks);
    });
    observer.observe(document, {childList: true, subtree: true, attributeFilter: ["href"]});
}


function main({settings}) {
    if (!settings.enabled) {
        return
    }
    let applicableGroup = Object.values(settings.groups || {})
        .map(makeClassInstantiator(Group)).find(canUseGroup);
    if (applicableGroup) {
        sullyLinks(applicableGroup);
    }
}

browser.storage.sync.get("settings").then(main);