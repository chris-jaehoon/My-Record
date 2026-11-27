import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <div className="not-found">
        <h1>페이지를 찾을 수 없습니다</h1>
        <p>주소가 바뀌었거나 삭제된 글일 수 있어요.</p>
        <Link href="/">글 목록으로 돌아가기</Link>
      </div>
    </div>
  );
}
