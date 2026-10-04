import React, { createContext, useContext } from 'react';

export interface ZoomContextType {
    zoomScale: number;
    setZoomScale: (scale: number) => void;
    resetZoom: () => void;
}

const defaultZoomContext: ZoomContextType = {
    zoomScale: 1.0,
    setZoomScale: () => { },
    resetZoom: () => { }
};

const ZoomContext = createContext<ZoomContextType>(defaultZoomContext);

export const ZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <ZoomContext.Provider value={defaultZoomContext}>
            {children}
        </ZoomContext.Provider>
    );
};

export const useZoom = (): ZoomContextType => {
    return useContext(ZoomContext);
};