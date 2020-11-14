import Ph_PostImage from "../components/post/postBody/postImage/postImage.js";
import { pushLinkToHistoryComb } from "../state/stateManager.js";

export function $id(id) {
	return document.getElementById(id);
}

export function $class(c) {
	return document.getElementsByClassName(c);
}

export function $tag(tag) {
	return document.getElementsByTagName(tag);
}

export function $css(query) {
	return $css(query);
}

Object.defineProperty(HTMLElement.prototype, "$id", {
	value: function(idName) {
		return this.getElementById(idName);
	}
});

Object.defineProperty(HTMLElement.prototype, "$class", {
	value: function(className) {
		return this.getElementsByClassName(className);
	}
});

Object.defineProperty(HTMLElement.prototype, "$tag", {
	value: function(tagName) {
		return this.getElementsByTagName(tagName);
	}
});

Object.defineProperty(HTMLElement.prototype, "$css", {
	value: function(cssQuery) {
		return this.querySelectorAll(cssQuery);
	}
});

export function linksToSpa(elem: HTMLElement): void {
	if (elem instanceof HTMLAnchorElement) {
		setLinkOnClick(elem);
	}
	for (const a of elem.getElementsByTagName("a")) {
		setLinkOnClick(a);
	}
}

function setLinkOnClick(elem: HTMLAnchorElement) {
	if (elem.href.match(location.origin)) {
		elem.onclick = linkOnClick;
	}
}

function linkOnClick(e) {
	if (e.ctrlKey) {
		return true;
	}

	pushLinkToHistoryComb(e.currentTarget.getAttribute("href"));

	return false;
}

export function classInElementTree(elem: HTMLElement, className: string): boolean {
	return Boolean(elem) && (elem.classList.contains(className) || classInElementTree(elem.parentElement, className));
}

export function elementWithClassInTree(elem: HTMLElement, className: string): HTMLElement {
	return elem && (elem.classList.contains(className) && elem || elementWithClassInTree(elem.parentElement, className));
}

export function linksToInlineImages(elem: HTMLElement) {
	const links = elem.$tag("a");
	for (let link of links) {
		if (!(/^[^?]+\.(png|jpg|jpeg|gif)(\?.*)?$/).test((link as HTMLAnchorElement).href)) {
			continue;
		}

		const image = new Ph_PostImage([{originalUrl: (link as HTMLAnchorElement).href, caption: ""}]);
		link.innerHTML = "";
		link.appendChild(image);
		link.classList.add("inlineImage");

		(link as HTMLAnchorElement).onclick = (e: MouseEvent) => Boolean(e.ctrlKey);
	}
}
