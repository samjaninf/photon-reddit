import {
	deleteThing,
	edit,
	redditApiRequest,
	save,
	vote,
	VoteDirection,
	voteDirectionFromLikes
} from "../../api/api.js";
import { mainURL } from "../../utils/consts.js";
import { thisUserName } from "../../utils/globals.js";
import { linksToSpa } from "../../utils/htmlStuff.js";
import { RedditApiType } from "../../utils/types.js";
import { isObjectEmpty, numberToShort, replaceRedditLinks, timePassedSinceStr } from "../../utils/utils.js";
import Ph_FeedItem from "../feed/feedItem/feedItem.js";
import Ph_DropDown, { DirectionX, DirectionY } from "../misc/dropDown/dropDown.js";
import Ph_DropDownEntry, { DropDownEntryParam } from "../misc/dropDown/dropDownEntry/dropDownEntry.js";
import Ph_CommentForm from "../misc/markdownForm/commentForm/commentForm.js";
import Ph_MarkdownForm from "../misc/markdownForm/markdownForm.js";
import Ph_Toast, { Level } from "../misc/toast/toast.js";
import Votable from "../misc/votable/votable.js";

export default class Ph_Comment extends Ph_FeedItem implements Votable {
	voteUpButton: HTMLButtonElement;
	currentUpvotes: HTMLDivElement;
	voteDownButton: HTMLButtonElement;
	replyForm: Ph_CommentForm;
	childComments: HTMLElement;
	// Votable implementation
	totalVotes: number;
	votableId: string;
	currentVoteDirection: VoteDirection;
	isSaved: boolean;
	postFullName: string;
	bodyMarkdown: string;

	constructor(commentData: RedditApiType, isChild: boolean, isInFeed: boolean, postFullName: string) {
		super(commentData, isInFeed);

		this.classList.add("comment");
		if (!isChild) {
			this.classList.add("rootComment");
		}

		if (commentData.kind === "more") {
			this.postFullName = postFullName;
			const loadMoreButton = document.createElement("button");
			loadMoreButton.innerText = `Load more (${commentData.data["count"]})`;
			let nextChildren = commentData.data["children"] as unknown as string[];
			loadMoreButton.addEventListener("click", async () => {
				loadMoreButton.disabled = true;
				try {
					const loadedComments = await this.loadMoreComments(nextChildren);

					for (const comment of loadedComments) {
						this.insertAdjacentElement("beforebegin",
							new Ph_Comment(comment, isChild, isInFeed, postFullName));
					}
				} catch (e) {
					console.error("Error loading more comments");
					console.error(e);
					new Ph_Toast(Level.Error, "Error loading more comments");
				}
				loadMoreButton.remove();
			});
			this.appendChild(loadMoreButton);
			return;
		} else if (commentData.kind !== "t1") {
			new Ph_Toast(Level.Error, "Error occurred while making comment");
			throw "Invalid comment data type";
		}

		this.bodyMarkdown = commentData.data["body"];

		this.votableId = commentData.data["name"];
		this.currentVoteDirection = voteDirectionFromLikes(commentData.data["likes"]);
		this.totalVotes = parseInt(commentData.data["ups"]) + -parseInt(this.currentVoteDirection);
		this.isSaved = commentData.data["saved"];

		// actions bar
		const actionBar = document.createElement("div");
		actionBar.className = "actions";
		// vote up button
		this.voteUpButton = document.createElement("button");
		this.voteUpButton.className = "vote";
		this.voteUpButton.innerText = "+";
		this.voteUpButton.addEventListener("click", e => this.vote(VoteDirection.up));
		actionBar.appendChild(this.voteUpButton);
		// current votes
		this.currentUpvotes = document.createElement("div");
		this.currentUpvotes.className = "upvotes";
		this.setVotesState();
		actionBar.appendChild(this.currentUpvotes);
		// vote down button
		this.voteDownButton = document.createElement("button");
		this.voteDownButton.className = "vote";
		this.voteDownButton.innerText = "-";
		this.voteDownButton.addEventListener("click", e => this.vote(VoteDirection.down));
		actionBar.appendChild(this.voteDownButton);
		// additional actions drop down
		let dropDownParams: DropDownEntryParam[] = [{
			displayHTML: "Reply",
			onSelectCallback: this.showReplyForm.bind(this)
		}];
		if (commentData.data["author"] === thisUserName) {
			dropDownParams.push({displayHTML: "Edit", onSelectCallback: this.edit.bind(this)});
			dropDownParams.push({displayHTML: "Delete", onSelectCallback: this.delete.bind(this)});
		}
		dropDownParams.push(...[
			{ displayHTML: this.isSaved ? "Unsave" : "Save", onSelectCallback: this.toggleSave.bind(this) },
			{ displayHTML: "Share", nestedEntries: [
					{displayHTML: "Copy Comment Link", value: "comment link", onSelectCallback: this.share.bind(this)},
					{displayHTML: "Copy Reddit Link", value: "reddit link", onSelectCallback: this.share.bind(this)},
				]
			}
		]);
		const moreDropDown = new Ph_DropDown(dropDownParams, "...", DirectionX.left, DirectionY.bottom, true);
		actionBar.appendChild(moreDropDown);
		const commentCollapser = document.createElement("div");
		commentCollapser.className = "commentCollapser";
		commentCollapser.innerHTML = `<div></div>`;
		commentCollapser.addEventListener("click", e => this.collapse(e));
		actionBar.appendChild(commentCollapser);
		this.appendChild(actionBar);

		const mainPart = document.createElement("div");
		mainPart.className = "w100";
		let userAdditionClasses = "";
		if (commentData.data["is_submitter"]) {
			userAdditionClasses += " op";
		}
		if (commentData.data["distinguished"] === "moderator") {
			userAdditionClasses += " mod";
		}
		mainPart.innerHTML = `
			<div class="header flex">
				<a href="/user/${commentData.data["author"]}" class="user${userAdditionClasses}">
					<span>u/${commentData.data["author"]}</span>
				</a>
				<div class="dropdown">${new Date(parseInt(commentData.data["created_utc"])).toTimeString()}</div>
				<div class="time">${timePassedSinceStr(commentData.data["created_utc"])}</div>
				<span>ago</span>
			</div>
			<div class="content">
				${commentData.data["body_html"]}
			</div>
		`;

		for (const a of mainPart.getElementsByTagName("a")) {
			a.target = "_blank";
		}

		this.childComments = document.createElement("div");
		this.childComments.className = "replies";
		mainPart.appendChild(this.childComments);

		this.replyForm = new Ph_CommentForm(this, true);
		this.replyForm.classList.add("hide");
		this.replyForm.addEventListener("ph-comment-submitted", (e: CustomEvent) => {
			this.replyForm.insertAdjacentElement("afterend",
				new Ph_Comment(e.detail, true, false, postFullName));
			this.replyForm.classList.add("hide");
		});
		this.replyForm.addEventListener("ph-cancel", () => this.replyForm.classList.add("hide"));

		this.childComments.appendChild(this.replyForm);
		if (commentData.data["replies"] && commentData.data["replies"]["data"]["children"]) {
			for (const comment of commentData.data["replies"]["data"]["children"]) {
				this.childComments.appendChild(new Ph_Comment(comment, true, false, postFullName));
			}
		}

		this.appendChild(mainPart);

		replaceRedditLinks(this);
		linksToSpa(this);
	}

	collapse(e: MouseEvent) {
		this.classList.toggle("isCollapsed");
	}

	showReplyForm() {
		this.replyForm.classList.remove("hide");
	}

	async loadMoreComments(children: string[]): Promise<RedditApiType[]> {
		const childData = await redditApiRequest("/api/morechildren", [
			["api_type", "json"],
			["children", children.join(",")],
			["link_id", this.postFullName],
			["sort", "confidence"],
			["limit_children", "false"],
		], false, {method: "POST"});

		let commentTree: RedditApiType[] = [];
		for (const comment of childData["json"]["data"]["things"] as RedditApiType[]) {
			if (!this.tryAttachToCommentTree(commentTree, comment)) {
				commentTree.push(comment);
			}

		}

		return commentTree;
	}

	private tryAttachToCommentTree(tree: RedditApiType[], commentData): boolean {
		for (let elem of tree) {
			if (elem.data["name"] === commentData.data["parent_id"]) {
				if (!elem.data["replies"] || elem.data["replies"]["kind"] !== "Listing") {
					elem.data["replies"] = <RedditApiType> {
						kind: "Listing",
						data: {
							children: []
						}
					};
				}
				elem.data["replies"]["data"]["children"].push(commentData);
				return true;
			} else if (elem.data["replies"] && elem.data["replies"]["kind"] === "Listing") {
				if (this.tryAttachToCommentTree(elem.data["replies"]["data"]["children"], commentData)) {
					return true;
				}
			}
		}

		return false;
	}

	async vote(dir: VoteDirection): Promise<void> {
		const prevDir = this.currentVoteDirection;
		this.currentVoteDirection = dir === this.currentVoteDirection ? VoteDirection.none : dir;
		this.setVotesState();
		const res = await vote(this);
		if (!res) {
			console.error("Error voting on post");
			this.currentVoteDirection = prevDir;
			this.setVotesState();
			new Ph_Toast(Level.Error, "Error occurred while voting");
		}
	};

	setVotesState() {
		this.currentUpvotes.innerText = numberToShort(this.totalVotes + parseInt(this.currentVoteDirection));
		switch (this.currentVoteDirection) {
			case VoteDirection.up:
				this.currentUpvotes.style.color = "orange";
				break;
			case VoteDirection.none:
				this.currentUpvotes.style.color = "inherit";
				break;
			case VoteDirection.down:
				this.currentUpvotes.style.color = "royalblue";
				break;
		}
	}

	async toggleSave(valueChain: any[], source: Ph_DropDownEntry) {
		this.isSaved = !this.isSaved;
		source.innerText = this.isSaved ? "Unsave" : "Save";
		if (!await save(this)) {
			console.error(`error voting on comment ${this.votableId}`);
			new Ph_Toast(Level.Error, "Error saving post");
		}
	}

	share([_, shareType]) {
		switch (shareType) {
			case "comment link":
				navigator.clipboard.writeText(mainURL + this.link);
				break;
			case "reddit link":
				navigator.clipboard.writeText("reddit.com" + this.link);
				break;
			default:
				throw "Invalid share type";

		}
	}

	async edit() {
		this.classList.add("isEditing");

		const editForm = new Ph_MarkdownForm("Edit", true);
		editForm.commentTextField.value = this.bodyMarkdown;
		editForm.addEventListener("ph-submit", async () => {
			try {
				const resp = await edit(this, editForm.commentTextField.value);

				if (resp["json"] && resp["json"]["errors"]) {
					new Ph_Toast(Level.Error, resp["json"]["errors"][0].join(" | "));
					return;
				} else if (resp["error"]) {
					new Ph_Toast(Level.Error, resp["message"]);
					return;
				}
				this.bodyMarkdown = resp["body"];
				this.classList.remove("isEditing");
				this.getElementsByClassName("content")[0].innerHTML = resp["body_html"];
				editForm.remove();
				new Ph_Toast(Level.Success, "Edited comment", 2000);
			} catch (e) {
				console.error("Error editing comment");
				console.error(e);
				new Ph_Toast(Level.Error, "Error editing comment");
			}
		});
		editForm.addEventListener("ph-cancel", () => editForm.remove());
		this.childComments.insertAdjacentElement("beforebegin", editForm);
	}

	async delete() {
		try {
			const resp = await deleteThing(this);

			if (!isObjectEmpty(resp) || resp["error"]) {
				console.error("Error deleting comment");
				console.error(resp);
				new Ph_Toast(Level.Error, "Error deleting comment");
				return;
			}

			this.getElementsByClassName("content")[0].innerHTML = "[deleted]";
			new Ph_Toast(Level.Success, "Deleted comment", 2000);
		} catch (e) {
			console.error("Error deleting comment");
			console.error(e);
			new Ph_Toast(Level.Error, "Error deleting comment");
		}
	}
}

customElements.define("ph-comment", Ph_Comment);
