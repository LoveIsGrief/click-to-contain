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


function createOnClickLink(url) {
    return function onClickLink(event) {
        try {
            // TODO improve contextualIdentities doc
            // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/contextualIdentities/create
            // Impossible to use contextualIdentities in contentScript
            backgroundPort.postMessage({
                command: "openTab",
                data: {
                    url: url
                }
            })
        } catch (e) {
            console.error("problem while posting message", e)
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
}


/**
 * Cleans a link of most click and mouse handler impurities
 *
 * (in preparation to be properly sullied)
 * @param $a {Node}
 * @returns {Node}
 */
function getCleanLink($a) {
    // Clone to remove all other event listeners in javascript
    let $clone = $a.cloneNode(true);

    // Remove click and mouse handlers in HTML
    Array.prototype.filter.call($clone.attributes, (attr) => {
        return attr.name.startsWith("onmouse") || attr.name.startsWith("onclick")
    }).forEach((attr) => {
        $clone.removeAttribute(attr.name)
    })
    $a.replaceWith($clone);
    return $clone
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
 * @type {Map<Node, callable>}
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
            .reduce((acc, curr) => {
                if (Array.isArray(curr)) {
                    acc = acc.concat(curr)
                } else {
                    acc.push(curr);
                }
                return acc
            }, [])
            .forEach((mutation) => {
                [mutation.target].concat(Array.prototype.map.call(mutation.addedNodes, n => n))
                    .filter(node => node.nodeName.toLowerCase() === "a")
                    .filter($a => isValidProtocol($a.href) && !canUseGroup(group, $a.href))
                    .forEach(($a) => {
                        try {
                            //Update the click function so that the old one isn't the master or create a new one
                            let oldOnClick = sulliedMap.get($a);
                            if (oldOnClick) {
                                sulliedMap.delete($a);
                                $a.removeEventListener("click", oldOnClick, true);
                            }
                            let newOnclick = createOnClickLink($a.href);
                            sulliedMap.set($a, newOnclick);
                            $a.addEventListener("click", newOnclick, true);
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