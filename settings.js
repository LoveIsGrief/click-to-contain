// TODO possibility to define if the tabs should additionally be in private mode (makes sense?)
const CREATION_ID = "creation";


function getFormElements($form) {
    return {
        $id: $form.querySelector("#id"),
        $enabled: $form.querySelector("#enabled-checkbox"),
        $domainRegexs: $form.querySelector("#domain-regexs"),
        $submit: $form.querySelector("#submit"),
        $remove: $form.querySelector("#remove"),
    }
}


function getFormFor(groupId) {
    return document.querySelector(`#form-${groupId || CREATION_ID}`);
}

function makeFormFromGroup(group, groupId) {
    let form = document.importNode(template.content, true).firstElementChild;
    let {$id, $enabled, $domainRegexs, $submit, $remove} = getFormElements(form);
    form.id = `form-${groupId}`;
    $id.value = groupId;
    $enabled.checked = group.enabled;
    $domainRegexs.value = group.domainsRegexs.join("\n");
    $submit.innerHTML = "Update";
    $remove.style.display = "block";

    $submit.addEventListener("click", onUpdate.bind(null, groupId))
    $remove.addEventListener("click", onRemove.bind(null, groupId));
    return form
}

/**
 * Take care of updating a certain group from the form
 *
 * TODO form validation
 *
 * @param groupId {Number}
 */
function onUpdate(groupId) {
    let $formDiv = getFormFor(groupId);
    let {$enabled, $domainRegexs} = getFormElements($formDiv);
    let create = !groupId;
    let group = {
        enabled: $enabled.checked,
        domainsRegexs: $domainRegexs.value.split("\n")
    }
    if (create) {
        groupId = Date.now();
    }
    settings.groups[groupId] = group;
    browser.storage.sync.set({settings}).then(() => {
        if (create) {
            updateFormsContainer.appendChild(makeFormFromGroup(group, groupId));
        }
    })
}


function onRemove(groupId) {
    let $formDiv = getFormFor(groupId);
    if (settings.groups[groupId]) {
        delete settings.groups[groupId]
        browser.storage.sync.set({settings}).then(() => {
            $formDiv.remove();
        })
    }
}

let settings = null;
const template = document.getElementById("form-template");

let creationFormContainer = document.getElementById("creation-form-container");
let updateFormsContainer = document.getElementById("update-forms-container");


let creationForm = document.importNode(template.content, true);
creationFormContainer.appendChild(creationForm);
creationFormContainer.querySelector("#submit").addEventListener("click", onUpdate.bind(null, null));

browser.storage.sync.get("settings").then((o) => {
    settings = o.settings || {
        enabled: true,
        groups: {}
    };

    // Handle enabling or disabling the extension
    let $enableExtension = document.getElementById("enable-extension");
    $enableExtension.checked = settings.enabled;
    $enableExtension.addEventListener("change", () => {
        settings.enabled = $enableExtension.checked;
        browser.storage.sync.set({settings});
    })

    // Fill forms with existing groups
    settings.groups = settings.groups || {};
    for (let groupId of Object.keys(settings.groups)) {
        let group = settings.groups[groupId];
        updateFormsContainer.appendChild(makeFormFromGroup(group, groupId))
    }
})

