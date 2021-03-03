'use strict';

const express = require('express')
const server = express();

require('dotenv').config();

const cors = require('cors');
server.use(cors());


const pg = require('pg')
// const client = new pg.Client(process.env.DATABASE_URL)
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const superagent = require('superagent');

const meethodOverride = require('method-override')
server.use(meethodOverride('-method'))

const port = process.env.PORT || 4000

server.use(express.static('./public'));
server.use(express.urlencoded({ extended: true }));
server.set('view engine', 'ejs');

// Routes------------------------------------------------------------------------------

server.get('/', homePageHandler)              //  Home Page including the added books
server.get('/searches', searchFormHandler)    //  Search Form
server.post('/searches/new', infoHandler)     //  Search Results
server.post('/addbook', addHandler)           //  Adding Books
server.get('/books/:id', detailsHandler)      //  Viewing Books
server.put('/books/:id', updateHandler)       //  Update Books
server.delete('/books/:id', deleteHandler)    //  Delete Books
server.get('*', (req, res) => {               //  Wrong Route
    res.render('pages/error')
})

// Route Handler Functions-------------------------------------------------------------- 

function homePageHandler(req, res) {
    let SQL = `SELECT * FROM book;`
    client.query(SQL)
        .then(result => {
            res.render('pages/index', { homeData: result.rows, count: result.rows.length })
        })
}

function searchFormHandler(req, res) {
    res.render('pages/searches/new');
}

function infoHandler(req, res) {
    let BookName = req.body.searchBook;
    let select = req.body.sort
    let url = `https://www.googleapis.com/books/v1/volumes?q=+${select}:${BookName}`

    superagent.get(url)
        .then(bookData => {
            // console.log(bookData.body.items[0].volumeInfo.imageLinks.smallThumbnail)
            let bookArr = bookData.body.items.map(val => {
                return new Books(val)
            })
            res.render('pages/searches/show', { bookMenu: bookArr })
        })
}

function addHandler(req, res) {
    let SQL = `INSERT INTO book(title,author,isbn,image_url,description) VALUES ($1,$2,$3,$4,$5)RETURNING id;`
    let Body = req.body
    let safeValues = [Body.title, Body.author, Body.isbn, Body.image_url, Body.description]

    client.query(SQL, safeValues)
        .then(() => {
            res.redirect('/')
        })
}

function detailsHandler(req, res) {
    // console.log(req.params)
    let SQL = `SELECT * FROM book WHERE id=$1;`
    let safeValue = [req.params.id]
    client.query(SQL, safeValue)
        .then(result => {
            res.render('pages/books/detail', { book: result.rows[0] })
        })
}

function updateHandler(req, res) {
    // console.log(req.params.id)
    // console.log(req.body)
    let { title, author, isbn, image_url, description } = req.body

    let SQL = `UPDATE book SET title=$1,author=$2,isbn=$3,image_url=$4,description=$5 WHERE id=$6;`
    let safeValues = [title, author, isbn, image_url, description, req.params.id]
    client.query(SQL, safeValues)
        .then(() => {
            res.redirect(`/books/${req.params.id}`)
        })
}

function deleteHandler(req, res) {
    let SQL = `DELETE FROM book WHERE id=$1;`
    let safevalue = [req.params.id]

    client.query(SQL, safevalue)
        .then(() => {
            res.redirect('/');
        })
}


// Conctructor --------------------------------------------------------------------------------------

function Books(bookdata) {
    if (bookdata.volumeInfo.imageLinks !== undefined) {
        this.imgUrl = bookdata.volumeInfo.imageLinks.smallThumbnail;
    } else {
        this.imgUrl = ' ';
    }

    this.title = bookdata.volumeInfo.title;
    this.author = bookdata.volumeInfo.authors;
    this.isbn = (bookdata.volumeInfo.industryIdentifiers === undefined) ? "NO ISBN" : bookdata.volumeInfo.industryIdentifiers[0].type + bookdata.volumeInfo.industryIdentifiers[0].identifier
    this.description = bookdata.volumeInfo.description
}

client.connect()
    .then(() => {
        server.listen(port, () => {
            console.log(`Listening to Port ${port}`)
        });
    });