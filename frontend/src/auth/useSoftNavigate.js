import { useNavigate } from 'react-router-dom';

export function useSoftNavigate(duration = 260) {
  const navigate = useNavigate();
  return (to) => {
    const el = document.querySelector('.auth-bg');
    if (!el) {
      navigate(to);
      return;
    }
    el.classList.add('page-fade-out');
    window.setTimeout(() => navigate(to), duration);
  };
}
