import { getUserPreferences, redditApiRequest } from "../../api/redditApi";
import { StoredData } from "../../types/misc";
import { RedditPreferences, RedditUserInfo } from "../../types/redditTypes";
import { $class } from "../../utils/htmlStatics";
import { MultiManager } from "../../utils/MultiManager";
import { SubredditManager } from "../../utils/subredditManager";
import { StoredFeedInfo } from "../feed/feedInfo/feedInfo";
import Ph_UserDropDown from "../global/userDropDown/userDropDown";
import DataAccessor from "./dataAccessor";
import { deleteKey, setInStorage, wasDbUpgraded } from "./storageWrapper";
import Users from "./userManagement";

export const guestUserName = "#guest";
export const tmpLoginUserName = "#login";

export default class UserData extends DataAccessor<_UserData> {
	key: string;
	protected default: _UserData = {
		auth: {
			accessToken: null,
			refreshToken: null,
			expiration: null,
			scopes: null,
			loginTime: null,
			isLoggedIn: false,
		},
		caches: {
			subs: null,
			multis: null,
			feedInfos: {}
		},
		loginSubPromptDisplayed: false,
		redditPreferences: undefined,
		userData: null
	};
	subreddits = new SubredditManager();
	multireddits = new MultiManager();
	name: string;
	inboxUnreadIds: Set<string> = new Set();
	isLockOwner = false;
	isGuest: boolean;

	constructor(name: string) {
		super();

		this.key = `u/${name}`;
		this.name = name;
		this.isGuest = name === guestUserName;

		window.addEventListener("beforeunload", this.unlockBeforePageUnload.bind(this));
	}

	async init(): Promise<this> {
		await super.init();
		if (wasDbUpgraded.wasUpgraded) {
			this.tryMigrateFromLsToLoaded(["loginRecommendationFlag"], ["loginSubPromptDisplayed"], val => val === "set");
			await setInStorage(this.loaded, this.key);
		}
		return this;
	}

	async fetchName(): Promise<boolean> {
		await this.set(["userData"], await redditApiRequest("/api/v1/me", [], false));
		if ("error" in this.d.userData)
			return false;
		const oldName = this.name;
		this.name = this.d.userData.name || guestUserName;
		if (this.name && this.key.endsWith(tmpLoginUserName)) {
			await this.changeKey(oldName, this.name);
			await Users.global.set(["lastActiveUser"], this.name);
		}
		return true;
	}

	async fetchUserData(): Promise<void> {
		await Promise.all([
			Users.current.subreddits.load(),
			Users.current.multireddits.load(),
			Users.current.set(["redditPreferences"], Users.current.d.auth.isLoggedIn ? await getUserPreferences(): {})
		]);
	}

	get displayName(): string {
		return this.isGuest ?
			"Guest" :
			`u/${this.name}`;
	}

	async lockAuthData(): Promise<void> {
		await new Promise<void>(async resolve => {
			if ("authLock" in localStorage) {
				const onLsChanged = () => {
					if ("authLock" in localStorage)
						return;
					window.removeEventListener("storage", onLsChanged);
					clearTimeout(unlockTimeout);
					resolve();
				};
				window.addEventListener("storage", onLsChanged);
				const unlockFallbackFunc = async () => {
					window.removeEventListener("storage", onLsChanged);
					clearTimeout(unlockTimeout);
					this.unlockAuthData();
					resolve();
				};
				const unlockTimeout = setTimeout(unlockFallbackFunc, 7500);
			}
			else {
				resolve();
			}
		});
		this.isLockOwner = true;
		localStorage.setItem("authLock", "");
	}

	unlockAuthData(): void {
		this.isLockOwner = false;
		localStorage.removeItem("authLock");
	}

	private unlockBeforePageUnload() {
		if ("authLock" in localStorage && this.isLockOwner)
			this.unlockAuthData();
	}

	setInboxIdsUnreadState(inboxItemIds: string[], isUnread: boolean): void {
		for (const id of inboxItemIds)
			this.setInboxIdUnreadState(id, isUnread);
		this.updateUnreadBadge(this.getInboxUnreadCount());
	}

	setInboxIdUnreadState(inboxItemId: string, isUnread: boolean): void {
		if (isUnread)
			this.inboxUnreadIds.add(inboxItemId);
		else
			this.inboxUnreadIds.delete(inboxItemId);

		this.updateUnreadBadge(this.getInboxUnreadCount());
	}

	setAllInboxIdsAsRead() {
		this.inboxUnreadIds.clear();
		this.updateUnreadBadge(0);
	}

	private updateUnreadBadge(val: number) {
		if (this === Users.current)
			($class("userDropDown")[0] as Ph_UserDropDown).setUnreadCount(val);

	}

	getInboxUnreadCount(): number {
		return this.inboxUnreadIds.size;
	}

	protected async changeKey(oldName: string, newName: string): Promise<void> {
		if (Users.global.d.lastActiveUser === oldName)
			await Users.global.set(["lastActiveUser"], newName);
		await deleteKey(this.key);
		this.key = `u/${newName}`;
		await setInStorage(this.loaded, this.key);
	}
}

/**
 * This data is user specific
 */
interface _UserData {
	/** Information for OAuth and login state */
	auth: AuthData;
	/** The users reddit.com preferences */
	redditPreferences: RedditPreferences;
	/** If false, after logging in a info is displayed to subscribe to r/photon_reddit */
	loginSubPromptDisplayed: boolean;
	userData: RedditUserInfo;
	caches: QuickCaches;
}

export interface AuthData {
	accessToken: string,
	refreshToken?: string,
	expiration: number,
	isLoggedIn: boolean,
	scopes: string,
	loginTime: number,
}

export interface QuickCaches {
	subs: StoredData<any[]> | null,
	multis: StoredData<any[]> | null,
	feedInfos: { [url: string]: StoredFeedInfo<any> }
}
