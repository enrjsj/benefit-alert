import { useState } from "react";
import type { Benefit } from "./benefit";
import { deadlineCalendar, deadlineDays } from "./deadline";

export function DeadlineCalendarButton({ benefit, today }: { benefit: Benefit; today?: string }) {
  const [message, setMessage] = useState("");
  const days = deadlineDays(benefit.deadline, today);
  if (days === null || days < 0) return null;
  return <div className="calendar-action">
    <button className="secondary-button" onClick={() => {
      const calendar = deadlineCalendar(benefit);
      if (!calendar) return;
      try {
        const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url; link.download = `benefit-deadline-${benefit.deadline}.ics`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("내려받은 파일을 캘린더 앱에서 열어 추가해 주세요. 접수 종료 시각은 공식 안내를 확인해 주세요.");
      } catch { setMessage("캘린더 파일을 저장하지 못했어요. 다시 시도해 주세요."); }
    }}>마감일 캘린더 저장</button>
    {message && <p role="status" className="planning-help">{message}</p>}
  </div>;
}
