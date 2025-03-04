"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

/**
 * A hook that returns the current full URL including origin, pathname, and search params
 */
export const useCurrentUrl = (): string => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [fullUrl, setFullUrl] = useState<string>("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const url = new URL(pathname, window.location.origin);
            if (searchParams?.toString()) {
                url.search = searchParams.toString();
            }
            setFullUrl(url.toString());
        }
    }, [pathname, searchParams]);

    return fullUrl;
};
