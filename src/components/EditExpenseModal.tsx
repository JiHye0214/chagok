"use client";

import { useState } from "react";

type Expense = {
  id: number;
  amount: number;
  category: string;
  memo: string;
  date: string;
};

type EditExpenseModalProps = {
  expense: Expense;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  onDelete: (id: number) => void;
};

export default function EditExpenseModal({
  expense,
  onClose,
  onSave,
  onDelete,
}: EditExpenseModalProps) {
  const [amount, setAmount] = useState(String(expense.amount));
  const [category, setCategory] = useState(expense.category);
  const [memo, setMemo] = useState(expense.memo);

  const handleSave = () => {
    const numberAmount = Number(amount);

    if (!numberAmount || numberAmount <= 0) {
      alert("금액을 입력해주세요.");
      return;
    }

    onSave({
      id: expense.id,
      amount: numberAmount,
      category,
      memo,
      date: expense.date,
    });

    onClose();
  };

  const handleDelete = () => {
    const confirmed = window.confirm(
      "이 지출 기록을 삭제할까요?"
    );

    if (!confirmed) return;

    onDelete(expense.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6">

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            지출 수정
          </h2>

          <button
            onClick={onClose}
            className="text-2xl text-gray-400"
          >
            ×
          </button>
        </div>

        <div className="space-y-5">

          <div>
            <label className="mb-2 block text-sm text-gray-500">
              금액
            </label>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl bg-gray-100 px-4 py-4 text-xl outline-none"
            />
          </div>

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

          <div>
            <label className="mb-2 block text-sm text-gray-500">
              메모
            </label>

            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-2xl bg-gray-100 px-4 py-4 outline-none"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full rounded-2xl bg-black py-4 font-semibold text-white"
          >
            저장하기
          </button>

          <button
            onClick={handleDelete}
            className="w-full py-2 text-sm font-medium text-red-500"
          >
            지출 삭제
          </button>

        </div>
      </div>
    </div>
  );
}