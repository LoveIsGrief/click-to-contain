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


/**
 *
 * @param regex {RegExp}
 */
function matchesRegex(regex) {
    return regex.test(window.location)
}


function canUseGroup(group) {

    if (!group.enabled) {
        return
    }
    return group.domainsRegexs.find(matchesRegex)
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
 * Listen to each click on a link and make it open a new tab in a new randomized container
 */
function sullyLinks() {
    let thisHost = new URL(window.location).host;
    let $links = document.querySelectorAll("a");
    console.log("links", $links.length)
    for (var i = 0; i < $links.length; i++) {
        var $a = $links[i];
        if (new URL($a.href).host !== thisHost) {
            $a.addEventListener("click", onClickLink)
        }

    }
}


function main(settings) {
    settings = {
        enabled: true,
        groups: [
            {
                enabled: true,
                domainsRegexs: [
                    "^https?://(www\\.)?reddit\\.com"
                ]
            },
            {
                enabled: true,
                domainsRegexs: [
                    "mozilla"
                ]
            }
        ]
    }
    let fineForThis = settings.enabled && (settings.groups || []).map(makeClassInstantiator(Group)).find(canUseGroup);
    if (fineForThis) {
        sullyLinks();
    }
}

browser.storage.sync.get("settings").then(main);