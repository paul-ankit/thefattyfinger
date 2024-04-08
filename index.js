var express = require('express')
var ejs = require('ejs')
var bodyParser = require('body-parser')
var mysql = require('mysql')
const util = require('util');
var session = require('express-session')
// MYSQL part
mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: "",
    database: "node_project"
})

// Creating Localhost
var app = express();

app.use(express.static('public')); // accessing the public folder for css images etc

app.set("view engine", "ejs");  // setting up EJS as our view engine

// Server is listening on port 8000

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({secret:"secret"}))

// creating a function isProductInCart() to check if an item is already in cart or not

function isProductInCart(cart,id){

    for(let i=0;i<cart.length;i++){
        if (cart[i].id == id) {
            return true;
        }
    }

    return false;

}

// Creating a new function calculateTotal(cart,req) which will calculate the total  amount of products present in the cart and send it

function calculateTotal(cart,req){
    total = 0;
    for(let i=0; i<cart.length; i++){
       //if we're offering a discounted price
       if(cart[i].sale_price){
          total = total + (cart[i].sale_price*cart[i].quantity);
       }else{
          total = total + (cart[i].price*cart[i].quantity)
       }
    }
    req.session.total = total;
    return total;
 
 }

// localhost:8000

const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'node_project'
});

// Convert query function to promise-based using util.promisify
const query = util.promisify(pool.query).bind(pool);

// Route handler with async/await
app.get('/', async function(req, res) {
    try {
        // Await the query execution
        const result = await query("SELECT * FROM products");
        console.log("result", result);

        // Render the page with the result
        res.render('pages/index', { result: result });
    } catch (err) {
        console.error("Error occurred:", err);
        res.status(500).send("An error occurred while fetching data");
    }
});

app.listen("8000"); 

// Addind cart route

app.post('/add_to_cart',function(req,res){

    var id = req.body.id;
    var name = req.body.name;
    var price = req.body.price;
    var sale_price = req.body.sale_price;
    var quantity = req.body.quantity;
    var image = req.body.image;
    var product = {id:id,name:name,price:price,sale_price:sale_price,quantity:quantity,image:image};
 
 
    if(req.session.cart){
          var cart = req.session.cart;
 
          if(!isProductInCart(cart,id)){
             cart.push(product);
          }
    }else{
 
       req.session.cart = [product]
       var cart = req.session.cart;
 
    }
 
 
    //calculate total
    calculateTotal(cart,req);
 
    //return to cart page
    res.redirect('/cart');
 
 });

app.get('/cart', function(req,res){

    var cart = req.session.cart;
    var total = req.session.total;

    res.render('pages/cart',{cart:cart,total:total});

});

// creating function for remove product
// app.post('/remove_product' ,function(req,res){
//     var id = req.body.id;
//     var cart = req.session.cart;
 
//     for(let i=0; i<cart.length; i++){
//        if(cart[i].id == id){
//           cart.splice(cart.indexOf(i),1);
//        }
//     }
 
//     //re-calculate
//     calculateTotal(cart,req);
//     res.redirect('/cart');
 
// });

// creating function for edit quantity

app.post('/edit_product_quantity',function(req,res){

    //get values from inputs
    var id = req.body.id;
    var quantity = req.body.quantity;
    var increase_btn = req.body.increase_product_quantity;
    var decrease_btn = req.body.decrease_product_quantity;
 
    var cart = req.session.cart;

    

    // increase  the quantity of a single item in the cart

    if(increase_btn){
        for(let i=0; i<cart.length; i++){
           if(cart[i].id == id){
              if(cart[i].quantity > 0){
                 cart[i].quantity = parseInt(cart[i].quantity)+1;
              }
           }
        }
     }

    //  decrease the quantity of a single item in the cart

    if(decrease_btn){
        for(let i=0; i<cart.length; i++){
           if(cart[i].id == id){
              if(cart[i].quantity > 1){
                 cart[i].quantity = parseInt(cart[i].quantity)-1;
              }
           }
        }
     }

     calculateTotal(cart,req);
    res.redirect('/cart')

})

// Checkout

app.get('/checkout',function(req,res){
    var total = req.session.total
    res.render('pages/checkout',{total:total})
 })
 
 app.post('/place_order',function(req,res){
 
    var name = req.body.name;
    var email = req.body.email;
    var phone = req.body.phone;
    var city = req.body.city;
    var address = req.body.address;
    var cost = req.session.total;
    var status = "not paid";
    var date = new Date();
    var products_ids="";
    var id = Date.now();
    req.session.order_id = id;

    var con = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: "",
        database: "node_project"
    })

    var cart = req.session.cart;
   for(let i=0; i<cart.length; i++){
      products_ids = products_ids + "," +cart[i].id;
   }

    con.connect((err) => { 
        if (err) {
            console.log(err);
        }
        else{
            var query = "INSERT INTO orders(cost, name, email,status, city, address, phone, date,products_ids) VALUES ?";
            var values = [ [cost, name, email, status, city, address, phone, date,products_ids] ];
            con.query(query, [values], (err,result)=> {
                res.redirect('/payment')
            })
        }

    })
})

app.get('/payment',function(req,res){
    var total = req.session.total
    res.render('pages/payment',{total:total})
 })


// Creating Remove Product
app.post('/remove_product', function(req,res){

    var id = req.body.id;
    var cart = req.session.cart;

    for(let i = 0; i<cart.length; i++){
        if(cart[i].id == id){
            cart.splice(cart.indexOf(i),1);
        }
    }

    // recalculating total
    calculateTotal(cart,req);
    res.redirect('cart');

})

// verify payment
app.get("/verify_payment",function(req,res){
    var transaction_id = req.query.transaction_id;
    var order_id = req.session.order_id;
 
    var con =  mysql.createConnection({
       host:"localhost",
       user:"root",
       password:"",
       database:"node_project"
    })
    
 
    con.connect((err)=>{
             if(err){
                console.log(err);
             }else{
                var query = "INSERT INTO payments (order_id,transaction_id,date) VALUES ?";
                var values = [
                   [order_id,transaction_id,new Date()]
                ]
                con.query(query,[values],(err,result)=>{
                   
                   con.query("UPDATE orders SET status='paid' WHERE id='"+order_id+"'",(err,result)=>{})
                   res.redirect('/thank_you')
                
                })
             }  
       })   
    
 })

//  thankyou page

app.get("/thank_you",function(req,res){

    var order_id = req.session.order_id;
    res.render("pages/thank_you",{order_id:order_id})
 })
 
 
 app.get('/single_product',function(req,res){
 
    var id = req.query.id;
 
    var con = mysql.createConnection({
       host:"localhost",
       user:"root",
       password:"",
       database:"node_project"
    })
 
    con.query("SELECT * FROM products WHERE id='"+id+"'",(err,result)=>{
       res.render('pages/single_product',{result:result});
    })
 
 
 
 });

//  products

app.get('/products',function(req,res){

    var con = mysql.createConnection({
       host:"localhost",
       user:"root",
       password:"",
       database:"node_project"
    })
 
    con.query("SELECT * FROM products",(err,result)=>{
       res.render('pages/products',{result:result});
    })
 
   
    
 });
 
 app.get('/about',function(req,res){
    
    res.render('pages/about');
 });
