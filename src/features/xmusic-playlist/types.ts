export interface XMusicSong {
    key: string;
    title: string;
    artists: string[];
    duration: number; // in seconds
    kbit: number;
    streamUrl: string;
    image: string;
}

export interface XMusicPlaylist {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    songs: XMusicSong[];
}

export interface XMusicAuthConfig {
    username: string;
    password: string;
    autoLogin: boolean;
}

export type XMusicTabType = 'guide' | 'playlists' | 'code' | 'account';

export interface BrowserDownloadLink {
    name: string;
    store: string;
    icon: string;
    url: string;
    badgeColor: string;
}
