import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import Layout from "./Layout";
import { Button, ButtonLink, PageTitle } from "./ui";

/**
 * Catches a render error in a page so the site keeps working: token data comes from the chain,
 * where anyone with permission can write unexpected values. Reset by changing `resetKey` (the route).
 */
export default class ErrorBoundary extends Component<
	{ children: ReactNode; resetKey: string },
	{ error: Error | null; resetKey: string }
> {
	state = { error: null as Error | null, resetKey: this.props.resetKey };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	static getDerivedStateFromProps(props: { resetKey: string }, state: { error: Error | null; resetKey: string }) {
		return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Page crashed:", error, info.componentStack);
	}

	render() {
		if (!this.state.error) return this.props.children;
		return (
			<Layout>
				<div className="flex flex-col gap-8">
					<PageTitle title="Something on this page broke">
						The page hit data it couldn't display. Reloading may help; the token and your wallet are
						unaffected.
					</PageTitle>
					<p className="font-mono text-[12px] text-muted break-all">{this.state.error.message}</p>
					<div className="flex flex-wrap gap-3">
						<Button onClick={() => window.location.reload()}>Reload</Button>
						<ButtonLink variant="secondary" to="/">
							Home
						</ButtonLink>
					</div>
				</div>
			</Layout>
		);
	}
}
