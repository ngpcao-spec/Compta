import type { TxType } from '@/db/types';

export interface DefaultCategory {
  type: TxType;
  name: string;
  icon: string;
  color: string;
}

const e = (name: string, icon: string, color: string): DefaultCategory => ({
  type: 'expense',
  name,
  icon,
  color,
});
const i = (name: string, icon: string, color: string): DefaultCategory => ({
  type: 'income',
  name,
  icon,
  color,
});

/** SPEC §4. Miroir de la migration SQL (vérifié par un test). */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  e('Ăn uống', 'utensils', '#FBC02D'),
  e('Quần áo', 'shirt', '#26C6DA'),
  e('Thú cưng', 'cat', '#7986CB'),
  e('Mua sắm', 'shopping-cart', '#2196F3'),
  e('Cà phê', 'coffee', '#FF8A65'),
  e('Du lịch', 'plane', '#7E57C2'),
  e('Thể thao', 'dumbbell', '#C0CA33'),
  e('Trái cây', 'apple', '#66BB6A'),
  e('Quà tặng', 'gift', '#EC407A'),
  e('Game', 'gamepad-2', '#FF7043'),
  e('Đi lại', 'bus', '#42A5F5'),
  e('Xăng xe', 'fuel', '#8D6E63'),
  e('Tiền nhà', 'home', '#5C6BC0'),
  e('Điện', 'zap', '#FFCA28'),
  e('Nước', 'droplet', '#29B6F6'),
  e('Internet', 'wifi', '#26A69A'),
  e('Điện thoại', 'smartphone', '#78909C'),
  e('Y tế', 'stethoscope', '#EF5350'),
  e('Thuốc', 'pill', '#E57373'),
  e('Giáo dục', 'graduation-cap', '#3F51B5'),
  e('Sách', 'book-open', '#8D6E63'),
  e('Làm đẹp', 'sparkles', '#F06292'),
  e('Giải trí', 'party-popper', '#AB47BC'),
  e('Phim ảnh', 'clapperboard', '#5E35B1'),
  e('Con cái', 'baby', '#FFB74D'),
  e('Gia đình', 'users', '#4DB6AC'),
  e('Bảo hiểm', 'shield', '#546E7A'),
  e('Sửa chữa', 'wrench', '#90A4AE'),
  e('Đồ gia dụng', 'sofa', '#A1887F'),
  e('Rau củ', 'carrot', '#9CCC65'),
  e('Đồ uống', 'cup-soda', '#4FC3F7'),
  e('Hiếu hỉ', 'heart', '#E91E63'),
  e('Từ thiện', 'hand-heart', '#BA68C8'),
  e('Thuế', 'receipt', '#757575'),
  e('Khác', 'ellipsis', '#9E9E9E'),
  i('Lương', 'circle-dollar-sign', '#AB47BC'),
  i('Thưởng', 'award', '#FFA726'),
  i('Đầu tư', 'trending-up', '#26A69A'),
  i('Làm thêm', 'briefcase', '#42A5F5'),
  i('Thu nhập khác', 'plus-circle', '#9E9E9E'),
];
