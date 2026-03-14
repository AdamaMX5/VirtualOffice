import { useAuthStore } from './model/stores/authStore';
import OfficeCanvas from './components/OfficeCanvas';
import LoginModal from './components/modals/LoginModal';

const App = () => {
  const showModal = useAuthStore((s) => s.showModal);

  return (
    <>
      <OfficeCanvas />
      {showModal && <LoginModal />}
    </>
  );
};

export default App;
