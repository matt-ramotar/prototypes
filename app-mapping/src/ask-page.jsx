import {useState} from "react";
import {PromptInput} from "@heroui-pro/react/prompt-input";
import {PromptSuggestion} from "@heroui-pro/react/prompt-suggestion";
import {ask, SUGGESTIONS} from "./ask.js";
import {AskAnswer} from "./ask-answer.jsx";
import {PAGE, PageHeader} from "./ui.jsx";

export function AskPage({navigate}) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);

  const submit = (text) => {
    if (!text.trim()) return;
    setHistory((h) => [{q: text, r: ask(text, new Date())}, ...h]);
    setInput("");
  };

  return (
    <div className={PAGE}>
      <PageHeader
        chip="Live"
        chipColor="success"
        title="Ask the Map"
        description="Questions are answered from observation, with citations. Session-only — nothing is stored."
      />
      <PromptInput className="mt-6" value={input} onValueChange={setInput} onSubmit={() => submit(input)}>
        <PromptInput.Content>
          <PromptInput.TextArea placeholder="What does a new user in Germany see during onboarding?" />
        </PromptInput.Content>
        <PromptInput.Footer>
          <PromptInput.Send />
        </PromptInput.Footer>
      </PromptInput>
      <PromptSuggestion className="mt-4">
        <PromptSuggestion.Items>
          {SUGGESTIONS.map((s) => (
            <PromptSuggestion.Item key={s} onPress={() => submit(s)}>
              <PromptSuggestion.ItemTitle>{s}</PromptSuggestion.ItemTitle>
            </PromptSuggestion.Item>
          ))}
        </PromptSuggestion.Items>
      </PromptSuggestion>
      {history.map((h, i) => (
        <div key={history.length - i} className="mt-8">
          <p className="mb-3 text-sm font-semibold text-foreground">{h.q}</p>
          <AskAnswer result={h.r} navigate={navigate} />
        </div>
      ))}
    </div>
  );
}
