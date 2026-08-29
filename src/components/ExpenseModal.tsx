"use client";

import { useState } from "react";

type ExpenseModalProps = {
  onClose: () => void;
  onAdd: (expense: {
    amount: number;
    category: string;
    memo: string;
  }) => void;
};

export default function ExpenseModal({
  onClose,
  onAdd,
}: ExpenseModalProps) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("식비");
  const [memo, setMemo] = useState("");

  const handleSubmit = () => {
    const numberAmount = Number(amount);

    if (!numberAmount || numberAmount <= 0) {
      alert("금액을 입력해주세요.");
      return;
    }

    onAdd({
      amount: numberAmount,
      category,
      memo,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6">

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            지출 추가
          </h2>

          <button
            onClick={onClose}
            className="text-2xl text-gray-400"
          >
            ×
          </button>
        </div>

        <div className="space-y-5">

          {/* 금액 */}
          <div>
            <label className="mb-2 block text-sm text-gray-500">
              금액
            </label>

            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl bg-gray-100 px-4 py-4 text-xl outline-none"
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="mb-2 block text-sm text-gray-500">
              카테고리
            </label>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
            >
              <option>식비</option>
              <option>월세</option>
              <option>교통</option>
              <option>쇼핑</option>
              <option>여행</option>
              <option>고정비</option>
              <option>기타</option>
            </select>
          </div>

          {/* 메모 */}
          <div>
            <label className="mb-2 block text-sm text-gray-500">
              메모
            </label>

            <input
              type="text"
              placeholder="무엇을 샀나요?"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full rounded-2xl bg-black py-4 font-semibold text-white"
          >
            저장하기
          </button>

        </div>
      </div>
    </div>
  );
}