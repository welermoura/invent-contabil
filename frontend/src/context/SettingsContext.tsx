import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

interface SystemSettings {
    app_title?: string;
    favicon_url?: string;
    logo_url?: string;
    background_url?: string;
    theme_primary_color?: string;
    theme_text_color?: string;
    theme_background_color?: string;
}

interface SettingsContextType {
    settings: SystemSettings;
    loading: boolean;
    refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<SystemSettings>({});
    const [loading, setLoading] = useState(true);

    const refreshSettings = async () => {
        try {
            const response = await api.get('/settings/');
            setSettings(response.data);

            // Apply Global Side Effects
            if (response.data.app_title) {
                document.title = response.data.app_title;
            }
            if (response.data.favicon_url) {
                let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = `${api.defaults.baseURL}/${response.data.favicon_url}`;
            }

        } catch (error) {
            console.error("Failed to load settings", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshSettings();

        const handleSettingsUpdate = () => {
             refreshSettings();
        };

        window.addEventListener('settings_updated', handleSettingsUpdate);
        return () => window.removeEventListener('settings_updated', handleSettingsUpdate);
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
