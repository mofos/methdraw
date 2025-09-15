export interface AnalysisPrompt {
    text: string;
    description: string;
}

export const analysisPrompts: AnalysisPrompt[] = [
    {
        text: "what do you see in the canvas ignore the ui, chat, the tabs and other unwated elements, only descripb whats in the canvs",
        description: "General analysis of the screen content"
    },
    {
        text: "Describe the layout and UI elements visible in this screenshot.",
        description: "UI/UX analysis"
    },
    {
        text: "What text content is visible in this screenshot? Please list all readable text.",
        description: "Text content analysis"
    },
    {
        text: "Are there any images, icons, or visual elements in this screenshot? Please describe them.",
        description: "Visual elements analysis"
    },
    {
        text: "What is the main purpose or function of what's shown in this screenshot?",
        description: "Purpose analysis"
    }
];

export const getAnalysisPrompt = (type: string): string => {
    const prompt = analysisPrompts.find(p => p.description === type);
    return prompt ? prompt.text : analysisPrompts[0].text;
};

export const getPromptDescriptions = (): string[] => {
    return analysisPrompts.map(p => p.description);
}; 