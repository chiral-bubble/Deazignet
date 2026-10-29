/**
 * Steps Configuration for "How Dezignet Works" section.
 * Copy is preserved exactly from the original page.
 */

export interface StepConfig {
  number: string;
  stepIndex: number;
  title: string;
  description: string;
}

export const stepsData: StepConfig[] = [
  {
    number: '01',
    stepIndex: 1,
    title: 'Post Your Project',
    description: 'Describe your project, set your budget and timeline. It takes less than 5 minutes to get started.'
  },
  {
    number: '02',
    stepIndex: 2,
    title: 'Receive Proposals',
    description: 'Qualified architects, interior designers and engineers submit detailed proposals tailored to your project.'
  },
  {
    number: '03',
    stepIndex: 3,
    title: 'Hire & Collaborate',
    description: 'Select the best match, collaborate in real-time, and bring your vision to life with secure payments.'
  }
];
