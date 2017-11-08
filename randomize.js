const backgroundPort = browser.runtime.connect({
    name: "content-to-background"
});

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


function onClickLink(event) {
    try {
        // TODO improve contextualIdentities doc
        // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/contextualIdentities/create
        // Impossible to use contextualIdentities in contentScript
        backgroundPort.postMessage({
            command: "openTab",
            data: {
                url: event.target.href
            }
        })
    } catch (e) {
        console.error("problem while posting message", e)
    }
    event.preventDefault();
    event.stopPropagation();
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
 * Listen to each click on a link and make it open a new tab in a new randomized container
 * @param group {Group}
 */
function sullyLinks(group) {
    let $links = document.querySelectorAll("a");
    let sulliedLinkCount = 0;
    for (var i = 0; i < $links.length; i++) {
        try {
            var $a = $links[i];
            if (!canUseGroup(group, $a.href)) {
                getCleanLink($a).addEventListener("click", onClickLink);
                sulliedLinkCount++;
            }
        } catch (e) {
            console.error(e);
        }
    }
    console.info(`Sullied ${sulliedLinkCount} links`);
}


function main({settings}) {
    if(!settings.enabled){
        return
    }
    let applicableGroup = Object.values(settings.groups || {})
        .map(makeClassInstantiator(Group)).find(canUseGroup);
    if (applicableGroup) {
        sullyLinks(applicableGroup);
    }
}

browser.storage.sync.get("settings").then(main);