import Layout from "../components/Layout";
import ArtBand from "../components/art/ArtBand";
import { ButtonLink, PageTitle } from "../components/ui";

export default function NotFound() {
	return (
		<Layout hero={<ArtBand onChain tall position="60% 50%" />}>
			<div className="flex flex-col gap-8">
				<PageTitle title="Nothing at this address">
					When every link to an artwork dies, the thumbnail in the contract is what remains. This page
					doesn't have one.
				</PageTitle>
				<div>
					<ButtonLink to="/">Home →</ButtonLink>
				</div>
			</div>
		</Layout>
	);
}
