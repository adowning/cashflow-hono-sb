import { supabase } from "@/core/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export const getSessionFromToken = async (token: string): Promise<{ session: Session; user: User } | null> => {
	try {
		const _session = await supabase.auth.getUser(token);
		if (_session) {
			const session = _session.data as Session;
			const user = _session.data.user as User;
			return { session, user };
		}
		// return null;
		return null;
	} catch (error) {
		return null;
	}

	return null;
};

export const verifyToken = async (token: string): Promise<boolean> => {
	try {
		const _session = await supabase.auth.getUser(token);
		if (_session) {
			return true;
		}
		// return null;
		return false;
	} catch (error) {
		return false;
	}
};

export const verifySession = async (session: Session): Promise<boolean> => {
	try {
		const _session = await supabase.auth.getUser(session.access_token);
		if (_session) {
			return true;
		}
		// return null;
		return false;
	} catch (error) {
		return false;
	}
};

export const signInUsername = async (
	username: string,
	password: string,
): Promise<{ token: string; user: User } | null> => {
	try {
		const _session = await supabase.auth.signInWithPassword({
			email: `${username}@cashflowcasino.com`,
			password,
		});
		if (_session.data.session !== null) {
			const token = _session.data.session.access_token;
			const user = _session.data.user as User;
			return { token, user };
		}
		// return null;
		return null;
	} catch (error) {
		return null;
	}
	return null;
};
