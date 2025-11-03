
// type GetMeReturnType = AsyncReturnType<typeof getMe>
import { hc } from 'hono/client';
import type { Game } from '../../../backend/src/libs/database/schema/game';
import type {
    AppType,
    //   ZGetUserSchema,
    //   TGetUserType,
    TGetAllUsersType,
    UserWithBalance
} from '../../../backend/src/shared/types';

type GetMeDataType = Awaited<ReturnType<typeof getMe>> // This gives us Api.Auth.UserInfo
type GetAllUsersDataType = Awaited<ReturnType<typeof getAllUsersWithBalance>> // This gives us Api.Auth.UserInfo
type GetAllGamesDataType = Awaited<ReturnType<typeof getAllGames>> // This gives us Api.Auth.UserInfo

// Helper function to get Supabase auth token
export const getSupabaseAuthHeaders = () =>
{
    let _token = localStorage.getItem('sb-crqbazcsrncvbnapuxcp-auth-token')
    let token
    if (_token) token = JSON.parse(_token)
    const access_token = token?.access_token

    return access_token
        ? {
            Authorization: `Bearer ${access_token}`
        }
        : { Authorization: `Bearer ` }
}

export const client = hc<AppType>('/api')


export const getMe = async () =>
{
    const authHeaders = getSupabaseAuthHeaders()
    let _token = localStorage.getItem('sb-crqbazcsrncvbnapuxcp-auth-token')
    let token
    if (_token) token = JSON.parse(_token)
    console.log(token)
    token = token.access_token
    const refresh_token = token.refresh_token
    console.log(token)
    console.log(refresh_token)
    const res = await client.api.me.$get(
        {},
        // authHeaders
        {
            headers: { Authorization: `Bearer ${token}`, refresh_token: refresh_token } // Add auth headers to the request
        }
    )

    if (!res.ok) {
        throw new Error('Failed to fetch course')
    }

    const data = await res.json()
    return data
}
export type { GetMeDataType };

export const getAllUsersWithBalance = async ({ query, page, perPage }: TGetAllUsersType): Promise<UserWithBalance[]> =>
{
    const authHeaders = getSupabaseAuthHeaders()
    
    const res = await client.api.users.balances.$get({
        query: {
            query,
            page: String(page),
            perPage: String(perPage)
        }
    },
        {
            headers: authHeaders
        }
    )

    if (!res.ok) {
        throw new Error('Failed to fetch courses')
    }

    const users = await res.json()
    return users.data as unknown as UserWithBalance[]
}
export type { GetAllUsersDataType };


export const getAllGames = async ({ query, page, perPage, category }: any): Promise<Game[]> =>
{
    const authHeaders = getSupabaseAuthHeaders()
    // let _token = localStorage.getItem('sb-crqbazcsrncvbnapuxcp-auth-token')
    // let token
    // if (_token) token = JSON.parse(_token)
    // console.log(token)
    // token = token.access_token
    // const refresh_token = token.refresh_token
    // console.log(token)
    // console.log(refresh_token)
    // console.log(authHeaders)
    const res = await client.api.games.$get({
        query: {
            query,
            page: String(page),
            perPage: String(perPage),
            category
        }
    },
        {
            headers: authHeaders
        }
    )

    if (!res.ok) {
        throw new Error('Failed to fetch courses')
    }

    const games = await res.json()
    return games.data as unknown as Game[]
}
export type { GetAllGamesDataType };
