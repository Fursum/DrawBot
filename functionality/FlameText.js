const qs = require('querystring');
const axios = require('axios');

const config = {
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
};

module.exports = async (Text) => {
    
    const requestBody = {
        LogoID: '4',
        Text: Text,
        FontSize: '70',
        Color1_color: '#FF0000',
        Integer1: '15',
        Boolean1: 'on',
        Integer9: '0',
        Integer13: 'on',
        Integer12: 'on',
        BackgroundColor_color: '#FFFFFF'
    };
    let result = await axios.post("https://tr.cooltext.com/PostChange", qs.stringify(requestBody), config)
    return result.data.renderLocation;
}