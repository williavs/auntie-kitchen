import { readPantry } from "@/lib/pantry";
import PantryEditor from "@/components/PantryEditor";
export const dynamic = "force-dynamic";
export default function Pantry() { return <PantryEditor initial={readPantry()} />; }
