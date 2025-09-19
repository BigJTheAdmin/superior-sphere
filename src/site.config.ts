import type { SiteConfig } from "@/types";

export const siteConfig: SiteConfig = {
	author: "J The Admin",
	date: {
		locale: "en-US",
		options: {
			day: "numeric",
			month: "short",
			year: "numeric",
		},
	},
	description: "Networking tools, automation, and troubleshooting for IT professionals.",
	lang: "en-US",
	ogLocale: "en_US",
	title: "Ping.Trace.SSH",
	url: "https://pingtracessh.com",
};

export const menuLinks: { path: string; title: string }[] = [
	{
		path: "/",
		title: "Home",
	},	
		{
		path: "/services/",
		title: "Services",
	},
		{
		path: "/career/",
		title: "Career Tools",
	},	
	{
		path: "/free-tools/",
		title: "Networking Tools",
	},
	{
		path: "/breakroom/",
		title: "Breakroom",
	},
	{
		path: "/about/",
		title: "About",
	},
];
