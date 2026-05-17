import Ph_ModalPane from "../../misc/modalPane/modalPane";
import {makeElement, sleep} from "../../../utils/utils";
import { $class } from "../../../utils/htmlStatics";

export default class Ph_AnonymousAccessInfo extends Ph_ModalPane {
	constructor() {
		super(true);

		this.classList.add("anonymousAccessInfo");

		this.content.append(
			makeElement("h2", {}, "Important information"),
			makeElement("ul", {}, [
				makeElement("li", {}, "From now on, only anonymous access is officially supported"),
				makeElement("li", {}, "The reason is that Reddit is making it difficult to get official API access"),
				makeElement("li", {}, "Some features might not work"),
				makeElement("li", {}, "This is experimental"),
			]),
			makeElement("div", {class: "row"}, [
				makeElement("button", {class: "button", onclick: this.hide.bind(this)}, "Confirm"),
			]),
		);
	}

	static show() {
		const popup = new Ph_AnonymousAccessInfo();
		const settingsPane = $class("photonSettings")[0];
		if (settingsPane)
			settingsPane.before(popup);
		else
			document.body.append(popup);
		popup.show();
	}

	hide() {
		super.hide();
		sleep(1000).then(() => this.remove());
	}
}

customElements.define("ph-anonymous-access-info", Ph_AnonymousAccessInfo);