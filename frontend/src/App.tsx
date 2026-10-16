import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import ConnectModal from "./components/wallet/ConnectModal";
import TermsModal from "./components/TermsModal";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import { LoadingLine } from "./components/ui";
import { HEAD_END, HEAD_START, pageForPath, renderHead } from "./lib/seo";

function ScrollToTop() {
	const { pathname, hash } = useLocation();
	useEffect(() => {
		if (hash) {
			// Wait a frame so the target section has rendered.
			requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
			return;
		}
		window.scrollTo(0, 0);
	}, [pathname, hash]);
	return null;
}

// The landing page ships in the main bundle; the rest load when first visited.
const Collections = lazy(() => import("./pages/Collections"));
const Mint = lazy(() => import("./pages/Mint"));
const Update = lazy(() => import("./pages/Update"));
const CollectorZone = lazy(() => import("./pages/CollectorZone"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Routed() {
	const { pathname } = useLocation();
	return (
		<ErrorBoundary resetKey={pathname}>
			<Suspense
				fallback={
					<Layout>
						<LoadingLine label="Loading" />
					</Layout>
				}
			>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/collections" element={<Collections />} />
					<Route path="/mint" element={<Mint />} />
					<Route path="/update" element={<Update />} />
					<Route path="/collector-zone" element={<CollectorZone />} />
					<Route path="/terms" element={<Terms />} />
					<Route path="*" element={<NotFound />} />
				</Routes>
			</Suspense>
		</ErrorBoundary>
	);
}

const isMarker = (node: ChildNode, marker: string) =>
	node.nodeType === Node.COMMENT_NODE && `<!--${node.nodeValue}-->` === marker;

/**
 * Keeps the title and share tags in step with the route as the app navigates. The served HTML
 * already has the right ones for its URL (see pageMeta in vite.config.ts); this covers the pages
 * reached after it.
 */
function PageMeta() {
	const { pathname } = useLocation();
	useEffect(() => {
		const nodes = Array.from(document.head.childNodes);
		const start = nodes.findIndex((n) => isMarker(n, HEAD_START));
		const end = nodes.findIndex((n) => isMarker(n, HEAD_END));
		if (start < 0 || end < start) return;
		nodes.slice(start + 1, end).forEach((n) => n.remove());
		const template = document.createElement("template");
		template.innerHTML = renderHead(pageForPath(pathname));
		const tags = Array.from(template.content.children);
		tags.forEach((tag) => document.head.insertBefore(tag, nodes[end]));
	}, [pathname]);
	return null;
}

function App() {
	return (
		<Router>
			<ScrollToTop />
			<PageMeta />
			<ConnectModal />
			<TermsModal />
			<Routed />
		</Router>
	);
}

export default App;
