import { Check } from 'lucide-react';

export interface Step {
	title: string;
	description?: string;
}

export interface StepIndicatorProps {
	steps: Step[];
	currentStep: number;
	isDarkMode: boolean;
}

export function StepIndicator({ steps, currentStep, isDarkMode }: StepIndicatorProps) {
	return (
		<div className="w-full">
			<div className="flex items-center justify-between">
				{steps.map((step, index) => {
					const isCompleted = index < currentStep;
					const isCurrent = index === currentStep;

					return (
						<div key={index} className="flex items-center flex-1">
							<div className="flex flex-col items-center flex-1">
								{/* Step Circle */}
								<div
									className={`
										w-10 h-10 rounded-full
										flex items-center justify-center
										font-semibold text-sm
										transition-all duration-200
										${
											isCompleted
												? isDarkMode
													? 'bg-success-dark text-bg-dark'
													: 'bg-success text-white'
												: isCurrent
												? isDarkMode
													? 'bg-primary-dark text-bg-dark ring-4 ring-primary-dark/20'
													: 'bg-primary text-white ring-4 ring-primary/20'
												: isDarkMode
												? 'bg-surface-hover-dark text-text-tertiary-dark border-2 border-border-dark'
												: 'bg-surface-hover-light text-text-tertiary-light border-2 border-border-light'
										}
									`}
								>
									{isCompleted ? <Check className="w-5 h-5" /> : index + 1}
								</div>

								{/* Step Label */}
								<div className="mt-2 text-center">
									<p
										className={`
											text-xs font-medium
											${
												isCurrent
													? isDarkMode
														? 'text-text-primary-dark'
														: 'text-text-primary-light'
													: isDarkMode
													? 'text-text-tertiary-dark'
													: 'text-text-tertiary-light'
											}
										`}
									>
										{step.title}
									</p>
								</div>
							</div>

							{/* Connector Line */}
							{index < steps.length - 1 && (
								<div
									className={`
										h-0.5 flex-1 mx-2 mt-[-2rem]
										transition-all duration-200
										${
											index < currentStep
												? isDarkMode
													? 'bg-success-dark'
													: 'bg-success'
												: isDarkMode
												? 'bg-border-dark'
												: 'bg-border-light'
										}
									`}
								/>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

