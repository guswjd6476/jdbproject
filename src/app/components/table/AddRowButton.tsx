import { Button } from '../ui/Button';

export default function AddRowButton({ onClick }: { onClick: () => void }) {
    return <Button onClick={onClick}>행 추가</Button>;
}
