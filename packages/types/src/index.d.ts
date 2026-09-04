import { z } from "zod";
export type UserRole = "Super Admin" | "Admin" | "Moderator" | "User" | "Premium";
export declare const UserRoleSchema: z.ZodEnum<["Super Admin", "Admin", "Moderator", "User", "Premium"]>;
export type UserStatus = "active" | "inactive" | "suspended";
export interface UserProfile {
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatar?: string;
    bio?: string;
    country?: string;
    language?: string;
    theme?: string;
    premium: boolean;
    verified: boolean;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RegisterInputSchema: z.ZodObject<{
    username: z.ZodString;
    displayName: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    country: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    username: string;
    displayName: string;
    email: string;
    password: string;
    country?: string | undefined;
    language?: string | undefined;
}, {
    username: string;
    displayName: string;
    email: string;
    password: string;
    country?: string | undefined;
    language?: string | undefined;
}>;
export declare const LoginInputSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    rememberMe: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    rememberMe?: boolean | undefined;
}, {
    email: string;
    password: string;
    rememberMe?: boolean | undefined;
}>;
export declare const ForgotPasswordInputSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const ResetPasswordInputSchema: z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    newPassword: string;
}, {
    token: string;
    newPassword: string;
}>;
export declare const UpdateProfileInputSchema: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    avatar: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
    theme: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    displayName?: string | undefined;
    country?: string | undefined;
    language?: string | undefined;
    bio?: string | undefined;
    avatar?: string | undefined;
    theme?: string | undefined;
}, {
    displayName?: string | undefined;
    country?: string | undefined;
    language?: string | undefined;
    bio?: string | undefined;
    avatar?: string | undefined;
    theme?: string | undefined;
}>;
export interface Category {
    id: string;
    title: string;
    slug: string;
    description?: string;
    icon?: string;
    cover?: string;
    color?: string;
    sortOrder: number;
    enabled: boolean;
    tracks?: any[];
}
export declare const CategoryInputSchema: z.ZodObject<{
    title: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    cover: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    tracks: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodAny, "many">>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    slug: string;
    sortOrder: number;
    enabled: boolean;
    description?: string | undefined;
    icon?: string | undefined;
    cover?: string | undefined;
    color?: string | undefined;
    tracks?: any[] | undefined;
}, {
    title: string;
    slug: string;
    description?: string | undefined;
    icon?: string | undefined;
    cover?: string | undefined;
    color?: string | undefined;
    sortOrder?: number | undefined;
    enabled?: boolean | undefined;
    tracks?: any[] | undefined;
}>;
export declare const GENRES: readonly ["Pop", "Rock", "Jazz", "Hip Hop", "EDM", "Classical", "Country", "Metal", "R&B", "KPop", "Indie", "Lofi", "Instrumental", "Acoustic", "Custom"];
export declare const MOODS: readonly ["Workout", "Focus", "Sleep", "Study", "Party", "Relax", "Morning", "Night", "Travel", "Driving", "Gaming", "Coding", "Meditation", "Custom"];
export interface Genre {
    id: string;
    name: string;
    slug: string;
    description?: string;
    enabled: boolean;
}
export interface Mood {
    id: string;
    name: string;
    slug: string;
    description?: string;
    enabled: boolean;
}
export interface Banner {
    id: string;
    title: string;
    subtitle?: string;
    image: string;
    buttonText?: string;
    buttonColor?: string;
    targetType: "url" | "category" | "genre" | "playlist" | "artist" | "album" | "song";
    targetId?: string;
    enabled: boolean;
    sortOrder: number;
}
export declare const BannerInputSchema: z.ZodObject<{
    title: z.ZodString;
    subtitle: z.ZodOptional<z.ZodString>;
    image: z.ZodString;
    buttonText: z.ZodOptional<z.ZodString>;
    buttonColor: z.ZodOptional<z.ZodString>;
    targetType: z.ZodEnum<["url", "category", "genre", "playlist", "artist", "album", "song"]>;
    targetId: z.ZodOptional<z.ZodString>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    title: string;
    sortOrder: number;
    enabled: boolean;
    image: string;
    targetType: "url" | "category" | "genre" | "playlist" | "artist" | "album" | "song";
    subtitle?: string | undefined;
    buttonText?: string | undefined;
    buttonColor?: string | undefined;
    targetId?: string | undefined;
}, {
    title: string;
    image: string;
    targetType: "url" | "category" | "genre" | "playlist" | "artist" | "album" | "song";
    sortOrder?: number | undefined;
    enabled?: boolean | undefined;
    subtitle?: string | undefined;
    buttonText?: string | undefined;
    buttonColor?: string | undefined;
    targetId?: string | undefined;
}>;
export type SectionType = "search" | "playlist" | "artist" | "album" | "category" | "featured" | "recommendation" | "history" | "favorites" | "manual" | "banner";
export interface HomeSection {
    id: string;
    title: string;
    subtitle?: string;
    icon?: string;
    cover?: string;
    layout: "carousel" | "grid" | "list" | "banner";
    type: SectionType;
    query?: string;
    limit: number;
    sortOrder: number;
    enabled: boolean;
    provider: string;
    providerConfig?: Record<string, any>;
    tracks?: any[];
}
export declare const HomeSectionInputSchema: z.ZodObject<{
    title: z.ZodString;
    subtitle: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    cover: z.ZodOptional<z.ZodString>;
    layout: z.ZodEnum<["carousel", "grid", "list", "banner"]>;
    type: z.ZodEnum<["search", "playlist", "artist", "album", "category", "featured", "recommendation", "history", "favorites", "manual", "banner"]>;
    query: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    provider: z.ZodDefault<z.ZodString>;
    providerConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    tracks: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "category" | "playlist" | "artist" | "album" | "search" | "featured" | "recommendation" | "history" | "favorites" | "manual" | "banner";
    title: string;
    sortOrder: number;
    enabled: boolean;
    layout: "banner" | "carousel" | "grid" | "list";
    limit: number;
    provider: string;
    icon?: string | undefined;
    cover?: string | undefined;
    tracks?: any[] | undefined;
    subtitle?: string | undefined;
    query?: string | undefined;
    providerConfig?: Record<string, any> | undefined;
}, {
    type: "category" | "playlist" | "artist" | "album" | "search" | "featured" | "recommendation" | "history" | "favorites" | "manual" | "banner";
    title: string;
    layout: "banner" | "carousel" | "grid" | "list";
    icon?: string | undefined;
    cover?: string | undefined;
    sortOrder?: number | undefined;
    enabled?: boolean | undefined;
    tracks?: any[] | undefined;
    subtitle?: string | undefined;
    query?: string | undefined;
    limit?: number | undefined;
    provider?: string | undefined;
    providerConfig?: Record<string, any> | undefined;
}>;
export interface NormalizedTrack {
    id: string;
    vid?: string;
    title: string;
    artist: string;
    artistId?: string;
    album?: string;
    albumId?: string;
    cover: string;
    duration: number;
    url?: string;
    provider: string;
}
export interface NormalizedArtist {
    id: string;
    name: string;
    avatar: string;
    genres?: string[];
    provider: string;
}
export interface NormalizedAlbum {
    id: string;
    title: string;
    artist: string;
    artistId?: string;
    cover: string;
    releaseDate?: string;
    provider: string;
    tracks?: NormalizedTrack[];
}
export interface NormalizedSearchResults {
    tracks: NormalizedTrack[];
    albums: NormalizedAlbum[];
    artists: NormalizedArtist[];
}
export interface Playlist {
    id: string;
    title: string;
    slug: string;
    description?: string;
    cover?: string;
    creatorId: string;
    creatorName: string;
    isPublic: boolean;
    isCollaborative: boolean;
    isPinned: boolean;
    tracks: NormalizedTrack[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const PlaylistInputSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    cover: z.ZodOptional<z.ZodString>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
    isCollaborative: z.ZodDefault<z.ZodBoolean>;
    isPinned: z.ZodDefault<z.ZodBoolean>;
    tracks: z.ZodDefault<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    tracks: any[];
    isPublic: boolean;
    isCollaborative: boolean;
    isPinned: boolean;
    description?: string | undefined;
    cover?: string | undefined;
}, {
    title: string;
    description?: string | undefined;
    cover?: string | undefined;
    tracks?: any[] | undefined;
    isPublic?: boolean | undefined;
    isCollaborative?: boolean | undefined;
    isPinned?: boolean | undefined;
}>;
export interface SystemSettings {
    appName: string;
    logo?: string;
    darkLogo?: string;
    primaryColor: string;
    secondaryColor: string;
    theme: "dark" | "light" | "system";
    language: string;
    country: string;
    searchLimit: number;
    cacheTtl: number;
    maintenanceMode: boolean;
    minimumAppVersion: string;
    apiKeys: Record<string, string>;
}
export declare const SystemSettingsInputSchema: z.ZodObject<{
    appName: z.ZodString;
    logo: z.ZodOptional<z.ZodString>;
    darkLogo: z.ZodOptional<z.ZodString>;
    primaryColor: z.ZodString;
    secondaryColor: z.ZodString;
    theme: z.ZodEnum<["dark", "light", "system"]>;
    language: z.ZodString;
    country: z.ZodString;
    searchLimit: z.ZodNumber;
    cacheTtl: z.ZodNumber;
    maintenanceMode: z.ZodBoolean;
    minimumAppVersion: z.ZodString;
    apiKeys: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    country: string;
    language: string;
    theme: "dark" | "light" | "system";
    appName: string;
    primaryColor: string;
    secondaryColor: string;
    searchLimit: number;
    cacheTtl: number;
    maintenanceMode: boolean;
    minimumAppVersion: string;
    apiKeys: Record<string, string>;
    logo?: string | undefined;
    darkLogo?: string | undefined;
}, {
    country: string;
    language: string;
    theme: "dark" | "light" | "system";
    appName: string;
    primaryColor: string;
    secondaryColor: string;
    searchLimit: number;
    cacheTtl: number;
    maintenanceMode: boolean;
    minimumAppVersion: string;
    logo?: string | undefined;
    darkLogo?: string | undefined;
    apiKeys?: Record<string, string> | undefined;
}>;
export interface ApiResponse<T = any> {
    success: true;
    message: string;
    data: T;
}
export interface ApiErrorResponse {
    success: false;
    message: string;
    errors?: any[];
}
export interface AppConfig {
    id: string;
    packageName: string;
    admob: {
        appId?: string;
        bannerAdUnitId?: string;
        interstitialAdUnitId?: string;
        interSplashAdUnitId?: string;
        rewardedAdUnitId?: string;
        nativeAdUnitId?: string;
    };
    applovin: {
        sdkKey?: string;
        bannerAdUnitId?: string;
        interstitialAdUnitId?: string;
        interSplashAdUnitId?: string;
        rewardedAdUnitId?: string;
        nativeAdUnitId?: string;
    };
    ads: {
        bannerEnabled: boolean;
        interstitialEnabled: boolean;
        interSplashEnabled: boolean;
        rewardedEnabled: boolean;
        nativeEnabled: boolean;
        interstitialInterval: number;
        adProvider: "admob" | "applovin" | "none";
    };
    promoBanner?: {
        enabled: boolean;
        image?: string;
        targetUrl?: string;
    };
    appUpdate?: {
        forceUpdate: boolean;
        minimumVersion?: string;
        updateUrl?: string;
    };
    safeMode: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AppConfigInputSchema: z.ZodObject<{
    packageName: z.ZodString;
    admob: z.ZodDefault<z.ZodObject<{
        appId: z.ZodOptional<z.ZodString>;
        bannerAdUnitId: z.ZodOptional<z.ZodString>;
        interstitialAdUnitId: z.ZodOptional<z.ZodString>;
        interSplashAdUnitId: z.ZodOptional<z.ZodString>;
        rewardedAdUnitId: z.ZodOptional<z.ZodString>;
        nativeAdUnitId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        appId?: string | undefined;
        bannerAdUnitId?: string | undefined;
        interstitialAdUnitId?: string | undefined;
        interSplashAdUnitId?: string | undefined;
        rewardedAdUnitId?: string | undefined;
        nativeAdUnitId?: string | undefined;
    }, {
        appId?: string | undefined;
        bannerAdUnitId?: string | undefined;
        interstitialAdUnitId?: string | undefined;
        interSplashAdUnitId?: string | undefined;
        rewardedAdUnitId?: string | undefined;
        nativeAdUnitId?: string | undefined;
    }>>;
    applovin: z.ZodDefault<z.ZodObject<{
        sdkKey: z.ZodOptional<z.ZodString>;
        bannerAdUnitId: z.ZodOptional<z.ZodString>;
        interstitialAdUnitId: z.ZodOptional<z.ZodString>;
        interSplashAdUnitId: z.ZodOptional<z.ZodString>;
        rewardedAdUnitId: z.ZodOptional<z.ZodString>;
        nativeAdUnitId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        bannerAdUnitId?: string | undefined;
        interstitialAdUnitId?: string | undefined;
        interSplashAdUnitId?: string | undefined;
        rewardedAdUnitId?: string | undefined;
        nativeAdUnitId?: string | undefined;
        sdkKey?: string | undefined;
    }, {
        bannerAdUnitId?: string | undefined;
        interstitialAdUnitId?: string | undefined;
        interSplashAdUnitId?: string | undefined;
        rewardedAdUnitId?: string | undefined;
        nativeAdUnitId?: string | undefined;
        sdkKey?: string | undefined;
    }>>;
    ads: z.ZodDefault<z.ZodObject<{
        bannerEnabled: z.ZodDefault<z.ZodBoolean>;
        interstitialEnabled: z.ZodDefault<z.ZodBoolean>;
        interSplashEnabled: z.ZodDefault<z.ZodBoolean>;
        rewardedEnabled: z.ZodDefault<z.ZodBoolean>;
        nativeEnabled: z.ZodDefault<z.ZodBoolean>;
        interstitialInterval: z.ZodDefault<z.ZodNumber>;
        adProvider: z.ZodDefault<z.ZodEnum<["admob", "applovin", "none"]>>;
    }, "strip", z.ZodTypeAny, {
        bannerEnabled: boolean;
        interstitialEnabled: boolean;
        interSplashEnabled: boolean;
        rewardedEnabled: boolean;
        nativeEnabled: boolean;
        interstitialInterval: number;
        adProvider: "admob" | "applovin" | "none";
    }, {
        bannerEnabled?: boolean | undefined;
        interstitialEnabled?: boolean | undefined;
        interSplashEnabled?: boolean | undefined;
        rewardedEnabled?: boolean | undefined;
        nativeEnabled?: boolean | undefined;
        interstitialInterval?: number | undefined;
        adProvider?: "admob" | "applovin" | "none" | undefined;
    }>>;
    promoBanner: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        image: z.ZodOptional<z.ZodString>;
        targetUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        image?: string | undefined;
        targetUrl?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        image?: string | undefined;
        targetUrl?: string | undefined;
    }>>;
    appUpdate: z.ZodDefault<z.ZodObject<{
        forceUpdate: z.ZodDefault<z.ZodBoolean>;
        minimumVersion: z.ZodOptional<z.ZodString>;
        updateUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        forceUpdate: boolean;
        minimumVersion?: string | undefined;
        updateUrl?: string | undefined;
    }, {
        forceUpdate?: boolean | undefined;
        minimumVersion?: string | undefined;
        updateUrl?: string | undefined;
    }>>;
    safeMode: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    admob: {
        appId?: string | undefined;
        bannerAdUnitId?: string | undefined;
        interstitialAdUnitId?: string | undefined;
        interSplashAdUnitId?: string | undefined;
        rewardedAdUnitId?: string | undefined;
        nativeAdUnitId?: string | undefined;
    };
    applovin: {
        bannerAdUnitId?: string | undefined;
        interstitialAdUnitId?: string | undefined;
        interSplashAdUnitId?: string | undefined;
        rewardedAdUnitId?: string | undefined;
        nativeAdUnitId?: string | undefined;
        sdkKey?: string | undefined;
    };
    packageName: string;
    ads: {
        bannerEnabled: boolean;
        interstitialEnabled: boolean;
        interSplashEnabled: boolean;
        rewardedEnabled: boolean;
        nativeEnabled: boolean;
        interstitialInterval: number;
        adProvider: "admob" | "applovin" | "none";
    };
    promoBanner: {
        enabled: boolean;
        image?: string | undefined;
        targetUrl?: string | undefined;
    };
    appUpdate: {
        forceUpdate: boolean;
        minimumVersion?: string | undefined;
        updateUrl?: string | undefined;
    };
    safeMode: boolean;
}, {
    packageName: string;
    admob?: {
        appId?: string | undefined;
        bannerAdUnitId?: string | undefined;
        interstitialAdUnitId?: string | undefined;
        interSplashAdUnitId?: string | undefined;
        rewardedAdUnitId?: string | undefined;
        nativeAdUnitId?: string | undefined;
    } | undefined;
    applovin?: {
        bannerAdUnitId?: string | undefined;
        interstitialAdUnitId?: string | undefined;
        interSplashAdUnitId?: string | undefined;
        rewardedAdUnitId?: string | undefined;
        nativeAdUnitId?: string | undefined;
        sdkKey?: string | undefined;
    } | undefined;
    ads?: {
        bannerEnabled?: boolean | undefined;
        interstitialEnabled?: boolean | undefined;
        interSplashEnabled?: boolean | undefined;
        rewardedEnabled?: boolean | undefined;
        nativeEnabled?: boolean | undefined;
        interstitialInterval?: number | undefined;
        adProvider?: "admob" | "applovin" | "none" | undefined;
    } | undefined;
    promoBanner?: {
        enabled?: boolean | undefined;
        image?: string | undefined;
        targetUrl?: string | undefined;
    } | undefined;
    appUpdate?: {
        forceUpdate?: boolean | undefined;
        minimumVersion?: string | undefined;
        updateUrl?: string | undefined;
    } | undefined;
    safeMode?: boolean | undefined;
}>;
//# sourceMappingURL=index.d.ts.map