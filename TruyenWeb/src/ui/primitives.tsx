import { CircleAlert, Leaf, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { navigate } from '../navigation';
import { asset } from './format';
export function Loading({ text = 'Đang mở trang sách…' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spinner" size={24} />
      <span>{text}</span>
    </div>
  );
}
export function ErrorMessage({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-state" role="alert">
      <CircleAlert />
      <h2>Chưa mở được trang sách</h2>
      <p>{message}</p>
      <button className="button secondary" onClick={retry}>
        Thử lại
      </button>
    </div>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? 'active' : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Brand() {
  return (
    <button className="brand" aria-label="Mộc, về thư viện" onClick={() => navigate('/')}>
      <img src={asset('logo-header.png')} alt="" width="42" height="42" />
      <span>
        <strong>
          mộc<span>.</span>
        </strong>
        <small>KHÔNG GIAN ĐỌC</small>
      </span>
    </button>
  );
}
export function Cover({ title, large = false }: { title: string; large?: boolean }) {
  return (
    <div className={`book-cover ${large ? 'large' : ''}`} aria-hidden="true">
      <div className="cover-frame">
        <Leaf size={23} strokeWidth={1} />
        <span className="cover-title">{title}</span>
        <span className="cover-footer">MỘC · THƯ VIỆN</span>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`dialog ${drawer ? 'drawer' : ''}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.clientX < event.currentTarget.getBoundingClientRect().left ||
            event.clientX > event.currentTarget.getBoundingClientRect().right ||
            event.clientY < event.currentTarget.getBoundingClientRect().top ||
            event.clientY > event.currentTarget.getBoundingClientRect().bottom)
        )
          onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">KHÔNG GIAN CỦA BẠN</span>
          <h2>{title}</h2>
        </div>
        <IconButton label={`Đóng ${title.toLowerCase()}`} onClick={onClose}>
          <X size={21} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
