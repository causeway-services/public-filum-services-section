import { Buffer } from "node:buffer";
import { render } from "@red-cup-engineering/web-theming-service/theming";
import { createNewscable, readNewscableSiteConfig, aggregateWires } from "@causeway-services/koios-news-service-section/src/news/newscable.mjs";
import { filumTheme } from "./theme.mjs";
const renderDocument = (title, content, options)=>render(filumTheme, content, {
        title,
        ...options.description === undefined ? {} : {
            description: options.description
        },
        ...options.canonical === undefined ? {} : {
            canonical: options.canonical
        },
        ...options.siteName === undefined ? {} : {
            siteName: options.siteName
        },
        ...options.links === undefined ? {} : {
            links: options.links
        }
    });
export async function createCableAppFromConfig(configPath, onSkip = ()=>{}) {
    const config = await readNewscableSiteConfig(configPath);
    const wires = aggregateWires(configPath, config, onSkip, renderDocument);
    return createNewscableApp(createNewscable({
        name: config.name,
        title: config.title,
        description: config.description,
        domain: config.domain,
        routing: config.routing,
        ...config.routingPrefix === undefined ? {} : {
            routingPrefix: config.routingPrefix
        },
        wires,
        render: renderDocument
    }));
}
export function createNewscableApp(cable) {
    return {
        resources: [
            {
                match: ()=>({}),
                methods: [
                    "GET",
                    "HEAD"
                ],
                handler: async (ctx)=>{
                    const host = ctx.req.headers.host ?? cable.domain;
                    const surface = await cable.handle(host, ctx.url.pathname);
                    ctx.res.writeHead(surface.status, {
                        ...surface.headers,
                        "content-length": String(Buffer.byteLength(surface.body))
                    });
                    ctx.res.end((ctx.req.method ?? "GET") === "HEAD" ? undefined : surface.body);
                }
            }
        ]
    };
}
