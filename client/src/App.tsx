import { useAuthStore } from './model/stores/authStore';
import { useDeskStore } from './model/stores/deskStore';
import { useServiceStatusStore } from './model/stores/serviceStatusStore';
import { useProfileStore } from './model/stores/profileStore';
import OfficeCanvas from './components/OfficeCanvas';
import LoginModal from './components/modals/LoginModal';
import DeskModal from './components/modals/DeskModal';
import ServiceStatusModal from './components/modals/ServiceStatusModal';
import ProfileModal from './components/modals/ProfileModal';

const App = () => {
  const showModal         = useAuthStore((s) => s.showModal);
  const openDeskId        = useDeskStore((s) => s.openDeskId);
  const serviceStatusOpen = useServiceStatusStore((s) => s.isOpen);
  const profileOpen       = useProfileStore((s) => s.isOpen);

  return (
    <>
      <OfficeCanvas />
      {showModal          && <LoginModal />}
      {openDeskId         && <DeskModal />}
      {serviceStatusOpen  && <ServiceStatusModal />}
      {profileOpen        && <ProfileModal />}
    </>
  );
};

export default App;
