interface HTMLElement {
	$id: (idName: string) => HTMLElement;
	$class: (className: string) => HTMLCollection;
	$tag: (tagName: string) => HTMLCollection;
	$css: (cssQuery: string) => HTMLCollection;
}
