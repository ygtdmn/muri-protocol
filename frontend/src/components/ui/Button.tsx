import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LinkProps } from "react-router-dom";
import { Loader } from "./Loader";
import { buttonClass } from "./buttonClass";
import type { ButtonSize, ButtonVariant } from "./buttonClass";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	fullWidth?: boolean;
	children: ReactNode;
}

export function Button({
	variant = "primary",
	size = "md",
	loading = false,
	fullWidth = false,
	disabled,
	type = "button",
	className = "",
	children,
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			disabled={disabled || loading}
			aria-busy={loading || undefined}
			className={buttonClass({ variant, size, fullWidth, className })}
			{...props}
		>
			{loading && <Loader />}
			{children}
		</button>
	);
}

export function ButtonLink({
	variant = "primary",
	size = "md",
	fullWidth = false,
	className = "",
	...props
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean }) {
	return (
		<Link className={buttonClass({ variant, size, fullWidth, className })} {...props} />
	);
}
