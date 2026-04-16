import { useAuthStore } from './model/stores/authStore';
import { useDeskStore } from './model/stores/deskStore';
import { useServiceStatusStore } from './model/stores/serviceStatusStore';
import OfficeCanvas from './components/OfficeCanvas';
import LoginModal from './components/modals/LoginModal';
import DeskModal from './components/modals/DeskModal';
import ServiceStatusModal from './components/modals/ServiceStatusModal';

const App = () => {
  const showModal       = useAuthStore((s) => s.showModal);
  const openDeskId      = useDeskStore((s) => s.openDeskId);
  const serviceStatusOpen = useServiceStatusStore((s) => s.isOpen);

  return (
    <>
      <OfficeCanvas />
      {showModal          && <LoginModal />}
      {openDeskId         && <DeskModal />}
      {serviceStatusOpen  && <ServiceStatusModal />}
    </>
  );
};

export default App;
