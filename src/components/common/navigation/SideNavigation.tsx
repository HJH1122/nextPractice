import { Button } from "@/components/ui/button";
import styles from "./SideNavigation.module.scss"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react";
import Link from "next/link";

function SideNavigation() {
	return <div className={styles.container}>
        <div className={styles.container__todos}>
            <Link href="/chat">
                <span className={styles.container__todos__label}>실시간 채팅</span>
            </Link>
        </div>
    </div>

}

export default SideNavigation;