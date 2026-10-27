import { page } from "@/lib/content";
export default function Log() { return <article className="prose" dangerouslySetInnerHTML={{ __html: page("cook-log") }} />; }
