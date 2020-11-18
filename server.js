// import dependencies
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
//const cors = require('cors');
// Express
const app = express();

const port = process.env.PORT || 8081;
// Yelp API Key
const yelpKey = process.env.YELP_KEY;
// Zomato API Key
const zomatoKey = process.env.ZOMATO_KEY;
const dir = `${__dirname}/client/`;

// CORS
//app.use(cors());
// Body Parser
app.use(bodyParser.json());

// Yelp weekday mapping
const dayMap = {
    0: 'Monday',
    1: 'Tuesday',
    2: 'Wednesday',
    3: 'Thursday',
    4: 'Friday',
    5: 'Saturday',
    6: 'Sunday',
}

// Convert hours from 2400 format to 12-hour AM/PM format
function formatTime(rawHours) {
    const hoursNum = parseInt(rawHours);
    let hours = Math.floor(hoursNum / 100); // 0 - 24
    let minutes = hoursNum - (hours*100); // 0 - 59
    if (hours > 12) {
        hours -= 12;
    }
    if (hours === 0) {
        hours = 12;
    }
    if (minutes < 10) {
        minutes = `0${minutes}`
    }
    return `${hours}:${minutes} ${hoursNum > 1159 ? 'PM' : 'AM'}`;
}

function formatOpenHours(hoursArr) {
    const finalHours = {}
    for (let day of hoursArr) {
        finalHours[dayMap[day.day]] = `${formatTime(day.start)} - ${formatTime(day.end)} `
    }

    return finalHours;
}

// Yelp retrieve list of places
app.post('/getPlaces', async (req, res) => {
    const latlng = req.body;

    const yelpOptions = {
        url: 'https://api.yelp.com/v3/graphql',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${yelpKey}`
        },
        data: {
            query: `
                {
                    search(term: "tacos",
                        latitude: ${latlng.lat},
                        longitude: ${latlng.lng},
                        limit: 50,
                        open_now: true) {
                        total
                        business {
                            id
                            coordinates {
                                latitude
                                longitude
                            }
                            name
                            rating
                            price
                            review_count
                            photos
                            categories {
                                alias
                            }
                            location {
                                formatted_address
                            }
                            phone
                            url
                            hours {
                                hours_type
                                is_open_now
                                open {
                                    day
                                    start
                                    end
                                    is_overnight
                                }
                            }
                        }
                    }
                }
            `
        }
    };

    const response = await axios(yelpOptions)

    // Add custom fields
    for (let business of response.data.data.search.business) {
        const hoursArr = business.hours[0].open;
        business.formatted_hours = formatOpenHours(hoursArr);
        business.categoriesString = business.categories.map(cat => {
            return cat.alias
        }).toString();
        business.formatted_address = business.location.formatted_address.split('\n')
        business.image_url = business.photos[0];
    }

    res.send(response.data);
});


// Zomato fetch menu
app.post('/getMenu', async (req, res) => {
    let menuUrl = null;
    const { latitude, longitude, name } = req.body;

    const zomatoOptions = {
        url: 'https://developers.zomato.com/api/v2.1/search',
        method: 'get',
        headers: {
            'user-key': `${zomatoKey}`
        },
        params: {
            lat: latitude,
            lon: longitude,
            q: name,
        },
    };

    const response = await axios(zomatoOptions)
    for (let restaurant of response.data.restaurants) {
        const nameTarget = name.toLowerCase().trim();
        const nameZomato = restaurant.restaurant.name.toLowerCase().trim();
        if (nameTarget === nameZomato) {
            menuUrl = restaurant.restaurant.menu_url;
        }
    }

    if (menuUrl) {
        res.json({menuUrl});
    } else {
        res.status(404).send('No menu data found')
    }
})
  

// Serve frontend
app.use(express.static('client'))

app.get("/", (req, res) => {
  res.sendFile(dir + "index.html");
});


// start the server
app.listen(port, () => {
    console.log(`listening on port ${port}`);
});