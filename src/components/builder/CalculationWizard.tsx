"use client";

import { Button } from "@/components/ui/Button";
import type { CalculationFieldConfig, CalculationToken, AppField } from "@/types";
import { tokensToExpression } from "@/lib/utils";
import { Trash2 } from "lucide-react";

interface CalculationWizardProps {
  config: CalculationFieldConfig;
  availableFields: AppField[];
  onChange: (config: CalculationFieldConfig) => void;
}

const OPERATORS: Array<"+" | "-" | "*" | "/" | "(" | ")"> = ["+", "-", "*", "/", "(", ")"];

export function CalculationWizard({
  config,
  availableFields,
  onChange,
}: CalculationWizardProps) {
  const cfg: CalculationFieldConfig = config ?? { expression: "", tokens: [] };

  function updateTokens(tokens: CalculationToken[]) {
    onChange({
      tokens,
      expression: tokensToExpression(tokens),
    });
  }

  function addField(field: AppField) {
    updateTokens([
      ...cfg.tokens,
      { type: "field", field_id: field.id, field_name: field.name },
    ]);
  }

  function addOperator(op: "+" | "-" | "*" | "/" | "(" | ")") {
    updateTokens([...cfg.tokens, { type: "operator", value: op }]);
  }

  function addNumber() {
    updateTokens([...cfg.tokens, { type: "number", value: 0 }]);
  }

  function removeToken(index: number) {
    updateTokens(cfg.tokens.filter((_, i) => i !== index));
  }

  function updateNumber(index: number, value: number) {
    const tokens = [...cfg.tokens];
    const token = tokens[index];
    if (token.type === "number") {
      tokens[index] = { ...token, value };
      updateTokens(tokens);
    }
  }

  function clearAll() {
    updateTokens([]);
  }

  return (
    <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
      <h4 className="text-sm font-semibold text-green-800">計算式ウィザード</h4>

      {/* 計算式プレビュー */}
      <div className="bg-white border rounded-lg p-3 font-mono text-sm min-h-[40px]">
        {cfg.tokens.length === 0 ? (
          <span className="text-gray-400">計算式を組み立ててください</span>
        ) : (
          cfg.tokens.map((token, i) => (
            <span
              key={i}
              className={
                token.type === "field"
                  ? "text-blue-600 bg-blue-50 px-1 rounded mx-0.5"
                  : token.type === "operator"
                    ? "text-gray-700 mx-0.5"
                    : "text-purple-600 mx-0.5"
              }
            >
              {token.type === "field"
                ? `{${token.field_name}}`
                : token.type === "operator"
                  ? token.value
                  : token.value}
            </span>
          ))
        )}
      </div>

      {/* トークン一覧（編集可能） */}
      {cfg.tokens.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cfg.tokens.map((token, i) => (
            <div
              key={i}
              className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs"
            >
              {token.type === "number" ? (
                <input
                  type="number"
                  className="w-16 border-none outline-none text-purple-600"
                  value={token.value}
                  onChange={(e) => updateNumber(i, Number(e.target.value))}
                />
              ) : (
                <span>
                  {token.type === "field" ? token.field_name : token.value}
                </span>
              )}
              <button onClick={() => removeToken(i)} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 px-2">
            クリア
          </button>
        </div>
      )}

      {/* フィールド選択 */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">フィールドを追加</p>
        <div className="flex flex-wrap gap-1">
          {availableFields.length === 0 ? (
            <p className="text-xs text-gray-400">数値フィールドがありません</p>
          ) : (
            availableFields.map((f) => (
              <button
                key={f.id}
                onClick={() => addField(f)}
                className="px-2 py-1 text-xs bg-white border rounded hover:bg-blue-50 hover:border-blue-300"
              >
                {f.label}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 演算子 */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">演算子</p>
        <div className="flex gap-1">
          {OPERATORS.map((op) => (
            <button
              key={op}
              onClick={() => addOperator(op)}
              className="w-8 h-8 text-sm font-mono bg-white border rounded hover:bg-gray-100"
            >
              {op}
            </button>
          ))}
          <button
            onClick={addNumber}
            className="px-2 h-8 text-xs bg-white border rounded hover:bg-gray-100"
          >
            数値
          </button>
        </div>
      </div>

      {/* 式プレビュー */}
      {cfg.expression && (
        <div className="text-xs text-gray-500">
          式: <code className="bg-white px-1 rounded">{cfg.expression}</code>
        </div>
      )}
    </div>
  );
}
