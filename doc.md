
// need to build the project stucture based on cart and buying and prevent duplicate checkout and race condition
tables
User
id
first name
last name
email 
is active
created_at
updated_at

• Product
id, name, description, price, quantity, created_at, updated_at

• Cart
id, user_id, created_at, updated_at

• CartItem
id, cart_id, product_id, quantity, created_at, updated_at

• Order
id, user_id, total_price, status created_at, updated_at

based on Reserve stock for 5 minutes will have to create order first in pending state and then if user buys in 5 min use the reserver stock else update the quanity

use of automatic update of stock quantity so race condition can be prevented
